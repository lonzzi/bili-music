import { MergeWithDefaultProps } from "@/types/MergeWithDefaultProps"
import { atom, useAtom } from "jotai"
import {
  handlePlayMusicAtom,
  handlePauseMusicAtom,
  musicPlayerStateAtom,
  handleJumpMusicProgressAtom,
  playingMusicVolumeAtom,
} from "@/stores/PlayingMusic/PlayingMusic"
import { PlayStatus } from "@/types/MusicPlayer"
import { useEffect } from "react"
import { FaPlay } from "react-icons/fa6"
import { FaPause } from "react-icons/fa6"
import { ConfigProvider, Slider } from "antd"
import PlayListDrawer from "../PlayList/PlayListDrawer"
import { PiPlaylist } from "react-icons/pi"
import { BiVolume, BiVolumeFull } from "react-icons/bi"
import ProgressBar from "../lib/ProgressBar"
import { useGlobalMusicController } from "@/hooks/useGlobalMusicController"
import MusicImage from "@/components/common/MusicImage"
import { CurrentPlayingMusicStorage } from "@/storage/CurrentPlayingMusic"

const progressAtom = atom(0)
const playListDrawerOpenAtom = atom(false)

const BottomControlBar = ({ className }: MergeWithDefaultProps) => {
  const globalMusicController = useGlobalMusicController()

  function formatDuration(value: number) {
    const minute = Math.floor(value / 60)
    const secondLeft = value - minute * 60
    return `${minute < 10 ? `0${minute}` : minute}:${secondLeft < 10 ? `0${secondLeft}` : secondLeft}`
  }

  function PlayOrPauseButton() {
    const [playingMusicState] = useAtom(musicPlayerStateAtom)
    const [, handlePlayMusic] = useAtom(handlePlayMusicAtom)
    const [, handlePauseMusic] = useAtom(handlePauseMusicAtom)
    return (
      <button
        className="inline-flex items-center justify-center bg-gray-400/20 hover:bg-gray-400/30 active:scale-90 w-9 h-9 rounded-full"
        aria-label={playingMusicState?.playStatus == PlayStatus.playing ? "pause" : "play"}
        onClick={() => {
          if (playingMusicState?.playStatus == PlayStatus.playing) {
            handlePauseMusic()
          } else {
            handlePlayMusic()
          }
        }}
      >
        {playingMusicState?.playStatus == PlayStatus.playing ? <FaPause /> : <FaPlay />}
      </button>
    )
  }

  function CoverImage() {
    const [playingMusicState] = useAtom(musicPlayerStateAtom)
    return playingMusicState?.cover ? (
      <MusicImage
        aria-label="cover"
        className="rounded-md w-12 h-12 object-cover"
        src={playingMusicState?.cover}
      ></MusicImage>
    ) : (
      <div></div>
    )
  }

  function TitleLabel() {
    const [playingMusicState] = useAtom(musicPlayerStateAtom)
    return <div className="text-sm ml-2 line-clamp-2">{playingMusicState?.title}</div>
  }

  function CurrentTimeLabel() {
    const [playingMusicState] = useAtom(musicPlayerStateAtom)
    if (
      !playingMusicState?.duration ||
      isNaN(playingMusicState?.duration) ||
      !playingMusicState?.progress ||
      isNaN(playingMusicState?.progress)
    ) {
      return formatDuration(0)
    }
    return formatDuration(Math.ceil((playingMusicState?.duration ?? 0) * (playingMusicState?.progress ?? 0)))
  }

  function EndingTimeLabel() {
    const [playingMusicState] = useAtom(musicPlayerStateAtom)
    return formatDuration(Math.ceil(playingMusicState?.duration ?? 0))
  }

  function ProgressSlider() {
    const [playingMusicState] = useAtom(musicPlayerStateAtom)
    const [progress, setProgress] = useAtom(progressAtom)
    const [, handleJumpMusicProgress] = useAtom(handleJumpMusicProgressAtom)

    useEffect(() => {
      setProgress((playingMusicState?.progress ?? 0) * 100)
    }, [playingMusicState, setProgress])

    return (
      <ConfigProvider
        theme={{
          components: {
            Slider: {
              handleLineWidthHover: 2,
              railBg: "rgba(150, 150, 150, 0.3)",
            },
          },
          token: {
            colorPrimary: "rgb(255, 19,   103)",
          },
        }}
      >
        <Slider
          className="w-full mx-2"
          aria-label="progess"
          defaultValue={0}
          value={progress}
          onChange={(value: number | number[]) => {
            setProgress(value as number)
          }}
          onChangeComplete={(value) => {
            handleJumpMusicProgress(value / 100)
          }}
        />
      </ConfigProvider>
    )
  }

  function PlayListButton() {
    const [playListDrawerOpen, setPlayListDrawerOpen] = useAtom(playListDrawerOpenAtom)
    return (
      <div className="mx-2">
        <button
          className="align-middle text-2xl text-slate-500 hover:text-slate-900"
          onClick={() => setPlayListDrawerOpen(true)}
        >
          <PiPlaylist />
        </button>
        <PlayListDrawer open={playListDrawerOpen} onClose={() => setPlayListDrawerOpen(false)} />
      </div>
    )
  }

  function VolumeControll() {
    const [volume, setVolume] = useAtom(playingMusicVolumeAtom)
    return (
      <div className="mx-2 flex-1 flex items-center">
        <button
          className="text-2xl text-slate-500 hover:text-slate-900 mr-2"
          onClick={() => {
            if (globalMusicController.isMuted()) {
              setVolume(globalMusicController.getCachedVolume())
              globalMusicController.cancelMute()
            } else {
              setVolume(0)
              globalMusicController.mute()
            }
          }}
        >
          {volume === 0 ? <BiVolume /> : <BiVolumeFull />}
        </button>
        <ProgressBar
          className={""}
          progress={volume}
          onChange={(value) => {
            setVolume(value)
            globalMusicController.setVolume(value)
          }}
          onChangeComplete={(value) => {
            CurrentPlayingMusicStorage.setVolume(value)
          }}
        />
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      <div className="h-full flex justify-between items-center relative px-5">
        <div className="simple-meta flex-[30%] flex items-center">
          <CoverImage />
          <TitleLabel />
        </div>
        <div className="control flex-[50%] justify-center pl-5 pr-5 text-slate-700">
          <div className="control-buttons flex justify-center items-center pt-2">
            <PlayOrPauseButton />
          </div>
          <div className="control-timer flex justify-center items-center">
            <CurrentTimeLabel />
            <ProgressSlider />
            <EndingTimeLabel />
          </div>
        </div>
        <div className="function flex-[30%] flex items-center">
          <PlayListButton />
          <VolumeControll />
        </div>
      </div>
    </div>
  )
}

export default BottomControlBar
