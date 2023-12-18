import { app, BrowserWindow, shell, ipcMain, session } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import { update } from './update'
import fs from 'fs-extra'

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '../')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
	? join(process.env.DIST_ELECTRON, '../public')
	: process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
	app.quit()
	process.exit(0)
}

app.commandLine.appendSwitch('disable-web-security')

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

async function createWindow() {
	win = new BrowserWindow({
		title: 'Bili Music',
		icon: join(process.env.VITE_PUBLIC as string, 'favicon.ico'),
		webPreferences: {
			// preload, // 打开加载页面
			// Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
			// Consider using contextBridge.exposeInMainWorld
			// Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
			nodeIntegration: true,
			contextIsolation: false,
		},
		// frame: false,
		titleBarStyle: 'hidden',
		titleBarOverlay: false,
		minHeight: 680,
		minWidth: 1100,
	})

	if (url) {
		// electron-vite-vue#298
		win.loadURL(url)
		// Open devTool if the app is not packaged
		win.webContents.openDevTools()
	} else {
		win.loadFile(indexHtml)
	}

	// Test actively push message to the Electron-Renderer
	win.webContents.on('did-finish-load', () => {
		win?.webContents.send('main-process-message', new Date().toLocaleString())
	})

	// Make all links open with the browser, not with the application
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith('https:')) shell.openExternal(url)
		return { action: 'deny' }
	})

	let parsedCookies = ''

	try {
		// get cookies
		const cookies = await fs.readJSON(
			join(app.getPath('userData'), 'cookies.json')
		)
		// console.log('Cookies loaded', cookies)
		parsedCookies = cookies
			.map((cookie) => `${cookie.name}=${cookie.value}`)
			.join('; ')
		// console.log('Cookies parsed', parsedCookies)
	} catch (err) {
		if (err.code !== 'ENOENT') console.error(err)
		else console.log('Cookies not found')
	}

	win.webContents.session.webRequest.onBeforeSendHeaders(
		(details, callback) => {
			details.requestHeaders['Referer'] = 'https://www.bilibili.com'
			if (parsedCookies) {
				details.requestHeaders['Cookie'] = parsedCookies
			}
			callback({ cancel: false, requestHeaders: details.requestHeaders })
		}
	)

	win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				'Referrer-Policy': ['no-referrer'],
				'Access-Control-Allow-Origin': ['*'],
			},
		})
	})

	ipcMain.on('close', () => {
		win?.close()
	})

	ipcMain.on('minimize', () => {
		win?.minimize()
	})

	ipcMain.on('maximize', () => {
		if (win?.isMaximized()) {
			win?.unmaximize()
		} else {
			win?.maximize()
		}
	})

	ipcMain.on('login', () => {
		const loginWindow = new BrowserWindow({
			modal: true,
			width: 400,
			height: 600,
		})

		loginWindow.loadURL('https://passport.bilibili.com/login')

		loginWindow.webContents.on('did-navigate', (_, url) => {
			if (url === 'https://www.bilibili.com/') {
				// Save cookies
				loginWindow.webContents.session.cookies.get({}).then((cookies) => {
					fs.writeJSON(join(app.getPath('userData'), 'cookies.json'), cookies)
					// console.log('Cookies saved', cookies)

					parsedCookies = cookies
						.map((cookie) => `${cookie.name}=${cookie.value}`)
						.join('; ')
				})

				win?.webContents.send('login-success')
				loginWindow.close()
			}
		})
	})

	ipcMain.on('logout', () => {
		fs.remove(join(app.getPath('userData'), 'cookies.json'))
		parsedCookies = ''
		session.defaultSession.clearStorageData()
		win?.webContents.send('logout-success')
	})

	// Apply electron-updater
	update(win)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
	win = null
	if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
	if (win) {
		// Focus on the main window if the user tried to open another
		if (win.isMinimized()) win.restore()
		win.focus()
	}
})

app.on('activate', () => {
	const allWindows = BrowserWindow.getAllWindows()
	if (allWindows.length) {
		allWindows[0].focus()
	} else {
		createWindow()
	}
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
	const childWindow = new BrowserWindow({
		webPreferences: {
			preload,
			nodeIntegration: true,
			contextIsolation: false,
		},
	})

	if (process.env.VITE_DEV_SERVER_URL) {
		childWindow.loadURL(`${url}#${arg}`)
	} else {
		childWindow.loadFile(indexHtml, { hash: arg })
	}
})