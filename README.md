# Screencst with Extra feature.

Adds extra features in gnome-shell's built-in screen cast feature.

- Record Audio with it.
- Specify framerate. (Up to 60 Hz.)

This is to aid simple use-cases, like simply recording some screen to share.

## Build and Install


```
# Build
./build.sh

# Install 
gnome-extensions install screencast.extra.feature@wissle.me-shell-extension.zip
```

## UI

UI of Built-in Screencast feature has top part and bottom part. This extension
adds additonal UI on these.

![Screen Shot 00](docs/screenshot_00.png)

1.  Top Part

    Two additional selectors for sound record. Each can be turned on or off
    individually.

    - Desktop: Record Desktop Sound, which is what you listen from speaker,
      like games, videos.

    - Mic: Record Mic Sound, which is what you say to microphone.
       
2.  Bottom Part

    Additional option for screen cast.

    - FPS: Framerate for screen cast. (How many pictures per seconds) Supported
      up to 60 Hz.
