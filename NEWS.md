## 0.3.1

Minor fix Release

- Fix: Follow common practice on audio pipeline.
  This will improve stability for audio processing, because of added `queue`
  element.

- Translation: Russian and Bulgarian translation is added, thanks to @pacu23 .
  (pacu23@gmail.com)

## 0.3

Feature Release

- Feature: Added spinner in screencast indicator.
  This is shown while screencast service is building pipeline.

- Configure: Added basic nvenc config.
  Cuda can be used, if cudaconvert is available.
  But uses gl if not.

## 0.2

Feature Release

- Feature: Quick Stop: Press "Capture Screen Cast" key combo (Usually
  <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>) to stop
  on-going screen cast.
- Feature: Downsize: Downsized resolution, from 100% to 33%.
  - Downsizing may introduce extra process.
- Fix: Fixed blurry audio select buttons.
- Misc: Added our own icons for audio select buttons.
- Internal changes
  - Check configures are available by launching `gst-inspect-1.0`.

## 0.1.1

Bug Fix Release

- Fix: Fixed screen cast fail, when framerate is not changed.
- Fix: Fixed teardown of framerate selector.
- Misc: Removed unused stylesheet.css


## 0.1

Initial Release

- Record Desktop Sound and Mic Sound.
  - Desktop sound is what you would listen, like games, videos, ...
  - Mic sound is what you would say.
- Specify framerate from 15 to 60.
