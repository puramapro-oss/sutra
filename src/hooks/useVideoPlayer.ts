import { useState, useCallback, RefObject } from 'react'

export function useVideoPlayer(videoRef: RefObject<HTMLVideoElement | null>) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }, [videoRef])

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setIsMuted(!isMuted)
  }, [isMuted, videoRef])

  const handleVolumeChange = useCallback(
    (val: number) => {
      if (!videoRef.current) return
      videoRef.current.volume = val
      setVolume(val)
      setIsMuted(val === 0)
    },
    [videoRef]
  )

  const handleSpeedChange = useCallback(
    (val: number) => {
      if (!videoRef.current) return
      videoRef.current.playbackRate = val
      setSpeed(val)
    },
    [videoRef]
  )

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return
    setCurrentTime(videoRef.current.currentTime)
  }, [videoRef])

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return
    setDuration(videoRef.current.duration)
  }, [videoRef])

  const seekTo = useCallback(
    (time: number) => {
      if (!videoRef.current) return
      videoRef.current.currentTime = time
      setCurrentTime(time)
    },
    [videoRef]
  )

  return {
    isPlaying,
    setIsPlaying,
    isMuted,
    volume,
    speed,
    currentTime,
    duration,
    setDuration,
    togglePlay,
    toggleMute,
    handleVolumeChange,
    handleSpeedChange,
    handleTimeUpdate,
    handleLoadedMetadata,
    seekTo,
  }
}
