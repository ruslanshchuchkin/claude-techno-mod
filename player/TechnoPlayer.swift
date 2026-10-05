// The sound card side of the techno player. The node player (techno.mjs)
// starts this app and talks to it over stdin and stdout, one JSON object per
// line. It plays the bars the node player renders, back to back with no gap,
// shows the track in Control Center ("Now Playing"), and passes the media
// keys (play/pause, next, previous) back.
//
// in:  {"op":"queue","id":7,"file":"/…/bar-7.f32"}   interleaved stereo Float32, 44.1 kHz
//      {"op":"cut"}                 drop the queued bars that have not started
//      {"op":"play"} {"op":"pause"} {"op":"info","title":"…","artist":"…"} {"op":"quit"}
// out: {"ev":"ready"} {"ev":"start","id":7,"t":<epoch ms>} {"ev":"cut","keep":6}
//      {"ev":"key","key":"toggle|play|pause|next|prev"} {"ev":"starve"}
//
// Build: swiftc -O TechnoPlayer.swift -o TechnoPlayer.app/Contents/MacOS/TechnoPlayer
import AppKit
import AVFoundation
import MediaPlayer

let sampleRate = 44100.0
// TECHNO_GAIN=0 mutes it (tests); the volume op scales it (1 = this gain)
let gain: Float = Float(ProcessInfo.processInfo.environment["TECHNO_GAIN"] ?? "") ?? 0.7

final class Segment {
  let id: Int
  let data: [Float]
  var pos = 0
  init(id: Int, data: [Float]) { self.id = id; self.data = data }
  var frames: Int { data.count / 2 }
}

final class Player {
  let engine = AVAudioEngine()
  var source: AVAudioSourceNode!
  let lock = NSLock()
  var queue: [Segment] = []
  var current: Segment?
  var events: [String] = []
  var starved = false
  var running = false
  // the volume: `level` is where it goes, `now` follows it over about 20 ms
  var level: Float = 1
  var now: Float = 1

  init() {
    let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
    source = AVAudioSourceNode(format: format) { [unowned self] _, _, frameCount, abl -> OSStatus in
      let buffers = UnsafeMutableAudioBufferListPointer(abl)
      let left = buffers[0].mData!.assumingMemoryBound(to: Float.self)
      let right = buffers[1].mData!.assumingMemoryBound(to: Float.self)
      let n = Int(frameCount)
      let latency = self.engine.outputNode.presentationLatency
      let now = Date().timeIntervalSince1970
      self.lock.lock()
      var i = 0
      while i < n {
        if self.current == nil || self.current!.pos >= self.current!.frames {
          if self.queue.isEmpty {
            if self.current != nil && !self.starved { self.events.append("{\"ev\":\"starve\"}"); self.starved = true }
            self.current = nil
            while i < n { left[i] = 0; right[i] = 0; i += 1 }
            break
          }
          self.current = self.queue.removeFirst()
          self.starved = false
          let t = (now + latency + Double(i) / sampleRate) * 1000
          self.events.append("{\"ev\":\"start\",\"id\":\(self.current!.id),\"t\":\(Int(t))}")
        }
        let seg = self.current!
        let take = min(n - i, seg.frames - seg.pos)
        seg.data.withUnsafeBufferPointer { p in
          for k in 0..<take {
            if self.now != self.level { self.now += max(-1.0 / 882, min(1.0 / 882, self.level - self.now)) }
            let g = gain * self.now
            left[i + k] = p[(seg.pos + k) * 2] * g
            right[i + k] = p[(seg.pos + k) * 2 + 1] * g
          }
        }
        seg.pos += take
        i += take
      }
      self.lock.unlock()
      return noErr
    }
    engine.attach(source)
    engine.connect(source, to: engine.mainMixerNode, format: format)
    // A big IO buffer (about 93 ms): the audio thread wakes about 8 times less
    // often than with the default 512 frames. The player queues whole bars
    // ahead, so the extra latency is never heard. This process only.
    if let unit = engine.outputNode.audioUnit {
      var frames: UInt32 = 4096
      AudioUnitSetProperty(unit, kAudioDevicePropertyBufferFrameSize, kAudioUnitScope_Global, 0, &frames, UInt32(MemoryLayout<UInt32>.size))
    }
  }

  func queueFile(id: Int, path: String) {
    guard let d = FileManager.default.contents(atPath: path) else { return }
    let floats = d.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
    try? FileManager.default.removeItem(atPath: path)
    lock.lock(); queue.append(Segment(id: id, data: floats)); lock.unlock()
  }

  // Drops what has not started. When the bar playing now is almost over,
  // its successor stays too, so the node player has time to render.
  func cut() {
    lock.lock()
    var keep = current?.id ?? -1
    if let c = current, Double(c.frames - c.pos) / sampleRate < 0.7, !queue.isEmpty {
      let next = queue.removeFirst()
      keep = next.id
      queue = [next]
    } else {
      queue = []
    }
    lock.unlock()
    emit("{\"ev\":\"cut\",\"keep\":\(keep)}")
  }

  func play() {
    if !running { try? engine.start(); running = true }
  }

  func pause() {
    lock.lock(); queue = []; current = nil; lock.unlock()
    if running { engine.pause(); running = false }
  }

  func drain() {
    lock.lock(); let out = events; events = []; lock.unlock()
    for line in out { emit(line) }
  }
}

func emit(_ line: String) {
  FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let player = Player()
let center = MPRemoteCommandCenter.shared()
var info: [String: Any] = [MPMediaItemPropertyTitle: "techno", MPMediaItemPropertyArtist: "techno"]

func setPlaying(_ on: Bool) {
  info[MPNowPlayingInfoPropertyPlaybackRate] = on ? 1.0 : 0.0
  MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  MPNowPlayingInfoCenter.default().playbackState = on ? .playing : .paused
}

func key(_ name: String) -> (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus {
  return { _ in emit("{\"ev\":\"key\",\"key\":\"\(name)\"}"); return .success }
}
center.togglePlayPauseCommand.addTarget(handler: key("toggle"))
center.playCommand.addTarget(handler: key("play"))
center.pauseCommand.addTarget(handler: key("pause"))
center.nextTrackCommand.addTarget(handler: key("next"))
center.previousTrackCommand.addTarget(handler: key("prev"))
for c in [center.togglePlayPauseCommand, center.playCommand, center.pauseCommand, center.nextTrackCommand, center.previousTrackCommand] { c.isEnabled = true }

// stdin: one command per line, read off the main thread
Thread.detachNewThread {
  while let line = readLine() {
    guard let d = line.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any], let op = o["op"] as? String else { continue }
    DispatchQueue.main.async {
      switch op {
      case "queue":
        if let id = o["id"] as? Int, let f = o["file"] as? String { player.queueFile(id: id, path: f) }
      case "cut": player.cut()
      case "play": player.play(); setPlaying(true)
      case "pause": player.pause(); setPlaying(false)
      case "info":
        if let t = o["title"] as? String { info[MPMediaItemPropertyTitle] = t }
        if let a = o["artist"] as? String { info[MPMediaItemPropertyArtist] = a }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      case "volume":
        if let v = o["level"] as? Double { player.lock.lock(); player.level = Float(max(0, min(2, v))); if !player.running { player.now = player.level }; player.lock.unlock() }
      case "quit": exit(0)
      default: break
      }
    }
  }
  // the node player is gone: so is the music
  DispatchQueue.main.async { exit(0) }
}

Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in player.drain() }
emit("{\"ev\":\"ready\"}")
app.run()
