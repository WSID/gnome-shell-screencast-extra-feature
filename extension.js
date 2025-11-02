/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

// GIR imports

import GLib from 'gi://GLib';

// Shell imports

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as PartAudio from "./parts/partaudio.js"
import * as PartFramerate from "./parts/partframerate.js"
import * as PartQuickStop from "./parts/partquickstop.js"
import * as PartDownsize from './parts/partdownsize.js';

// Some Constants


// Audio Pipeline Description.

/** A pipeline for audio record, in vorbis. */
const VORBIS_PIPELINE = "vorbisenc ! queue";

/** A pipeline for audio record, in aac. */
const AAC_PIPELINE = "avenc_aac ! queue"


// Video conversion and resize.

const HWENC_DMABUF_PREP_PIPELINE = "vapostproc";

const SWENC_DMABUF_PREP_PIPELINE = "glupload ! glcolorscale ! glcolorconvert ! gldownload ! queue";

const SWENC_MEMFD_PREP_PIPELINE = "videoconvert chroma-mode=none dither=none matrix-mode=output-only n-threads=%T ! videoscale ! queue"

/**
 * Configuration for pipeline.
 *
 * @typedef {object} Configure
 * @property {string} id Name of configuration.
 * @property {string} videoPrepPipeline Video Preparation pipeline. (convert & resize)
 * @property {string} videoPipeline Video encode pipeline.
 * @property {string} audioPipeline Audio encode pipeline.
 * @property {string} muxer Muxer pipeline.
 * @property {string} extension Extension of file name.
 */

/**
 * Configuration for pipeline.
 * video pipelines are copied from gnome-shell screencast service.
 * They would be probably in separated service, so I cannot monkey-patch on it.
 *
 * @type {Configure[]}
 */
const configures = [
  {
    id: "hwenc-dmabuf-h264-vaapi-lp",
    videoPrepPipeline: HWENC_DMABUF_PREP_PIPELINE,
    videoPipeline: [
        "vah264lpenc",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "hwenc-dmabuf-h264-vaapi",
    videoPrepPipeline: HWENC_DMABUF_PREP_PIPELINE,
    videoPipeline: [
        "vah264enc",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "swenc-dmabuf-h264-openh264",
    videoPrepPipeline: SWENC_DMABUF_PREP_PIPELINE,
    videoPipeline: [
        "openh264enc deblocking=off background-detection=false complexity=low adaptive-quantization=false qp-max=26 qp-min=26 multi-thread=%T slice-mode=auto",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "swenc-memfd-h264-openh264",
    videoPrepPipeline: SWENC_MEMFD_PREP_PIPELINE,
    videoPipeline: [
        "openh264enc deblocking=off background-detection=false complexity=low adaptive-quantization=false qp-max=26 qp-min=26 multi-thread=%T slice-mode=auto",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "swenc-dmabuf-vp8-vp8enc",
    videoPrepPipeline: SWENC_DMABUF_PREP_PIPELINE,
    videoPipeline: [
        "vp8enc cpu-used=16 max-quantizer=17 deadline=1 keyframe-mode=disabled threads=%T static-threshold=1000 buffer-size=20000",
        "queue",
    ].join(" ! "),
    audioPipeline: VORBIS_PIPELINE,
    muxer: "webmmux",
    extension: "webm"
  },
  {
    id: "swenc-memfd-vp8-vp8enc",
    videoPrepPipeline: SWENC_MEMFD_PREP_PIPELINE,
    videoPipeline: [
      'vp8enc cpu-used=16 max-quantizer=17 deadline=1 keyframe-mode=disabled threads=%T static-threshold=1000 buffer-size=20000',
      'queue'
    ].join(" ! "),
    audioPipeline: VORBIS_PIPELINE,
    muxer: "webmmux",
    extension: "webm"
  }
];

export default class ScreencastExtraFeature extends Extension {
    enable() {
        // Internal variables.
        this._configureIndex = 0;
        this._optionFramerate = 30;

        // Reference from Main UI
        this._screenshotUI = Main.screenshotUI;
        this._showPointerButtonContainer = this._screenshotUI._showPointerButtonContainer;
        this._shotButton = this._screenshotUI._shotButton;
        this._typeButtonContainer = this._screenshotUI._typeButtonContainer;
        this._screencastProxy = this._screenshotUI._screencastProxy;

        // Extension parts.
        this._partAudio = new PartAudio.PartAudio(
            this._screenshotUI,
            this._typeButtonContainer
        );

        this._partFramerate = new PartFramerate.PartFramerate(
            this._screenshotUI,
            this._showPointerButtonContainer
        );
        
        this._partDownsize = new PartDownsize.PartDownsize(
            this._screenshotUI,
            this._showPointerButtonContainer
        );

        this._partQuickStop = new PartQuickStop.PartQuickStop(
            this._screenshotUI
        );

        // Connect to signals.
        this._shotButtonNotifyChecked = this._shotButton.connect (
          'notify::checked',
          (_object, _pspec) => {
              this._partAudio.set_enabled(!this._shotButton.checked);
              this._partFramerate.set_enabled(!this._shotButton.checked);
              this._partDownsize.set_enabled(!this._shotButton.checked);
          }
        );

        // Monkey patch
        this._origProxyScreencast = this._screencastProxy.ScreencastAsync;
        this._origProxyScreencastArea = this._screencastProxy.ScreencastAreaAsync;

        this._screencastProxy.ScreencastAsync = this._screencastAsync.bind(this);
        this._screencastProxy.ScreencastAreaAsync = this._screencastAreaAsync.bind(this);
    }

    disable() {
        // Revert Monkey patch
        if (this._screencastProxy) {
            if (this._origProxyScreencast) {
                this._screencastProxy.ScreencastAsync = this._origProxyScreencast;
                this._origProxyScreencast = null;
            }

            if (this._origProxyScreencastArea) {
                this._screencastProxy.ScreencastAreaAsync = this._origProxyScreencastArea;
                this._origProxyScreencastArea = null;
            }

            this._screencastProxy = null;
        }

        // Revert UI
        if (this._shotButton) {
            if (this._shotButtonNotifyChecked) {
                this._shotButton.disconnect(this._shotButtonNotifyChecked);
                this._shotButtonNotifyChecked = null;
            }
            this._shotButton = null;
        }

        if (this._partAudio) {
            this._partAudio.destroy();
            this._partAudio = null;
        }

        if (this._partFramerate) {
            this._partFramerate.destroy();
            this._partFramerate = null;
        }
        
        if (this._partDownsize) {
            this._partDownsize.destroy();
            this._partDownsize = null;
        }

        if (this._partQuickStop) {
            this._partQuickStop.destroy();
            this._partQuickStop = null;
        }

        if (this._screenshotUI) {
            this._screenshotUI = null;
        }
    }

    // Privates

    /// Monkey patch for screencast async.
    ///
    /// Modify option for our configuration.
    ///
    /// filename: string: File name without extension.
    /// options: object: Options for screen cast.
    ///
    /// returns: (boolean, string): Success and the result filename with extension.
    async _screencastAsync(filename, options) {
        options['framerate'] = new GLib.Variant('i', this._partFramerate.get_framerate());
        while (this._configureIndex <= configures.length) {
            let configure = configures[this._configureIndex];

            // TODO: Get whole presented size.
            let pipeline = this._makePipelineString(configure, global.screen_width, global.screen_height);
            options['pipeline'] = new GLib.Variant('s', pipeline);

            try {
                var [success, filepath] = await this._origProxyScreencast.call(this._screencastProxy, filename, options);
                if (success) {
                    filepath = this._fixFilePath(filepath, configure.extension);
                }
                return [success, filepath];
            } catch (e) {
                this._configureIndex++;
                console.log(`Tried configure [${this._configureIndex}] ${configure.id}`);
                console.log(`- VIDEO_PREP: ${configure.videoPrepPipeline}`);
                console.log(`- VIDEO: ${configure.videoPipeline}`);
                console.log(`- AUDIO: ${configure.audioPipeline}`);
                console.log(`- MUXER: ${configure.muxer}`);
                console.log(`- ERROR: ${e}`);
            }
        }

        // If it reached here, all of pipeline configures are failed.
        throw Error("Tried all configure and failed!");
    }

    /// Monkey patch for screencast async.
    ///
    /// Modify option for our configuration.
    ///
    /// x: number: left coordinate of area.
    /// y: number: top coordinate or area.
    /// w: number: Width of area.
    /// h: number: Height of area.
    /// filename: string: File name without extension.
    /// options: object: Options for screen cast.
    ///
    /// returns: (boolean, string): Success and the result filename with extension.
    async _screencastAreaAsync(x, y, w, h, filename, options) {
        options['framerate'] = new GLib.Variant('i', this._partFramerate.get_framerate());
        while (this._configureIndex <= configures.length) {
            let configure = configures[this._configureIndex];

            let pipeline = this._makePipelineString(configure, w, h);
            options['pipeline'] = new GLib.Variant('s', pipeline);

            try {
                var [success, filepath] = await this._origProxyScreencastArea.call(this._screencastProxy, x, y, w, h, filename, options);
                if (success) {
                    filepath = this._fixFilePath(filepath, configure.extension);
                }
                return [success, filepath];
            } catch (e) {
                this._configureIndex++;
                console.log(`Tried configure [${this._configureIndex}] ${configure.id}`);
                console.log(`- VIDEO_PREP: ${configure.videoPrepPipeline}`);
                console.log(`- VIDEO: ${configure.videoPipeline}`);
                console.log(`- AUDIO: ${configure.audioPipeline}`);
                console.log(`- MUXER: ${configure.muxer}`);
                console.log(`- ERROR: ${e}`);
            }
        }

        // If it reached here, all of pipeline configures are failed.
        throw Error("Tried all configure and failed!");
    }

    /// Fix file path with wrong extension.
    ///
    /// Usually to fix '.unknown' file path.
    ///
    /// filepath: string: A filepath, with worng extension.
    /// extension: string: Desired extension of the file.
    ///
    /// returns: string: The new file path.
    _fixFilePath(filepath, extension) {
        console.log(`Fix file path: ${filepath}`);

        // Split extension from file name
        var newFileStem = filepath;
        let lastPoint = filepath.lastIndexOf('.')
        if (lastPoint !== -1) {
            newFileStem = filepath.substring(0, lastPoint);
        }
        let newFilepath = `${newFileStem}.${extension}`;

        console.log(`- Into : ${newFilepath}`);

        // Rename the file. (using GLib.)
        GLib.rename(filepath, newFilepath);
        return newFilepath;
    }

    /**
     * Make pipeline string for given set of pipeline descriptions.
     *
     * @param {Configure} configure A configure to form pipeline string.
     * @param {number} width Width of screen cast.
     * @param {number} height Height of screen cast.
     *
     * @returns {string} A combined pipeline description.
     */
    _makePipelineString(configure, width, height) {
        var videoSeg = null;
        let videoPrep = configure.videoPrepPipeline;
        let video = configure.videoPipeline;
        let muxer = configure.muxer;

        let downsizeRatio = this._partDownsize.getRatio();
        if (downsizeRatio != 1.00) {
            let downsizeWidth = Math.floor(width * downsizeRatio);
            let downsizeHeight = Math.floor(height * downsizeRatio);
            let downsizeCap = `video/x-raw,width=${downsizeWidth},height=${downsizeHeight}`

            videoSeg = `${videoPrep} ! ${downsizeCap} ! ${video} ! ${muxer} name=mux`;
        } else {
            videoSeg = `${videoPrep} ! ${video} ! ${muxer} name=mux`;
        }

        let audioSource = this._partAudio.get_added_audio_input();
        if (audioSource === null) {

            // If we don't use audio, we can just use video segment only.

            return videoSeg;
        } else {

            // Put 3 segments as pipeline description string.
            //
            // As screen cast service will prepend and append video source and
            //    file sink.
            //
            // 1. video pipeline -> mux
            //    First segment will be prepend with video source.
            //
            // 2. audio source -> audio pipeline -> mux
            //
            // 3. mux
            //    Last segment will be append with file sink.
            
            let audio = configure.audioPipeline;
            let audioSeg = `${audioSource} ! ${audio} ! mux.`;
            let muxerSeg = "mux.";

            return `${videoSeg} ${audioSeg} ${muxerSeg}`;
        }
    }
}
