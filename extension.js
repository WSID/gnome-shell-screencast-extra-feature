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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Shell imports

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as PartAdjust from "./parts/partadjust.js";
import * as PartAudio from "./parts/partaudio.js";
import * as PartQuickStop from "./parts/partquickstop.js";
import * as PartIndicator from "./parts/partindicator.js";

/**
 * Configuration for pipeline.
 *
 * @typedef {object} Configure
 * @property {string} id Name of configuration.
 * @property {string} videoPrepPipeline Video Preparation pipeline.
 * @property {?string} videoPrepDownsizePipeline Video Preparation pipeline for downsize, or null to use #videoPrepPipeline.
 * @property {string} videoPipeline Video encode pipeline.
 * @property {string} audioPipeline Audio encode pipeline.
 * @property {string} muxer Muxer pipeline.
 * @property {string} extension Extension of file name.
 */


/**
 * Fix file path with wrong extension.
 *
 * Usually to fix '.unknown' file path.
 *
 * @param {string} filepath A filepath, with worng extension.
 * @param {string} extension Desired extension of the file.
 * @returns {string} The new file path.
 */
function fixFilePath(filepath, extension) {
    // Split extension from file name
    var newFileStem = filepath;
    let lastPoint = filepath.lastIndexOf('.')
    if (lastPoint !== -1) {
        newFileStem = filepath.substring(0, lastPoint);
    }
    let newFilepath = `${newFileStem}.${extension}`;

    if (filepath != newFilepath) {
        // Rename the file. (using GLib.)
        GLib.rename(filepath, newFilepath);

        // Update Recent Items.
        // Directly access the list. Cannot use Gtk.RecentManager.

        // Copied from gnome-shell source.
        const recentListFile =
            GLib.build_filenamev([GLib.get_user_data_dir(), "recently-used.xbel"]);
        const recentList = new GLib.BookmarkFile();
        try {
            recentList.load_from_file(recentFile);
        } catch (e) {
            console.warn(`Could not open recent list: ${e.message}`);
        }

        try {
            const uri = Gio.File.new_for_path(filepath).get_uri();
            const newUri = Gio.File.new_for_path(newFilepath).get_uri();

            if (recentList.has_item(uri)) {
                recentList.move_item(uri, newUri);
            } else {
                recentList.add_application(newUri, GLib.get_prgname(), 'gio open %u');
            }
            recentList.to_file(recentListFile);
        } catch (e) {
            console.warn(`Could not save recent list: ${e.message}`);
        }
    }

    return newFilepath;
}

export default class ScreencastExtraFeature extends Extension {
    enable() {
        // Internal variables.
        /**
         * @type {Gio.Settings}
         */
        this._settings = this.getSettings("org.gnome.shell.extensions.screencastExtraFeature");

        /** @type {?Configure[]} */
        this._pipelineConfigures = null;
        this._pipelineConfigureIndex = 0;

        // Reference from Main UI
        this._screenshotUI = Main.screenshotUI;
        this._screenRecordingIndicator = Main.panel.statusArea.screenRecording;

        // Extension parts.
        this._partAdjust = new PartAdjust.PartAdjust(this._screenshotUI, this);
        this._partAudio = new PartAudio.PartAudio(this._screenshotUI, this.dir);
        this._partQuickStop = new PartQuickStop.PartQuickStop(this._screenshotUI);
        this._partIndicator = new PartIndicator.PartIndicator(this._screenshotUI, this._screenRecordingIndicator);

        // Monkey patch
        this._screencastProxy = this._screenshotUI._screencastProxy;
        this._origProxyScreencast = this._screencastProxy.ScreencastAsync;
        this._origProxyScreencastArea = this._screencastProxy.ScreencastAreaAsync;

        this._screencastProxy.ScreencastAsync = this._screencastAsync.bind(this);
        this._screencastProxy.ScreencastAreaAsync = this._screencastAreaAsync.bind(this);

        // Setup pipeline
        this._setupPipelineConfigure().catch((e) => {
            console.warn(`Setup pipeline configure failed: ${e}`);
        });

        this._settingsChangedPipelineConfigures = this._settings.connect("changed::pipeline-configures", () => {
            this._pipelineConfigures = null;
            this._pipelineConfigureIndex = 0;

            this._setupPipelineConfigure().catch((e) => {
                console.warn(`Setup pipeline configure failed: ${e}`);
            });
        });
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

        // Destroy parts.
        if (this._partIndicator) {
            this._partIndicator.destroy();
            this._partIndicator = null;
        }

        if (this._partAudio) {
            this._partAudio.destroy();
            this._partAudio = null;
        }

        if (this._partQuickStop) {
            this._partQuickStop.destroy();
            this._partQuickStop = null;
        }

        if (this._partAdjust) {
            this._partAdjust.destroy();
            this._partAdjust = null;
        }

        this._screenshotUI = null;

        // Internal variables
        if (this._settings && this._settingsChangedPipelineConfigures) {
            this._settings.disconnect(this._settingsChangedPipelineConfigures);
        }

        this._pipelineConfigures = null;

        this._settings = null;
    }

    // Privates

    /**
     * Monkey patch for screencast async.
     *
     * Modify option for our configuration.
     *
     * @param {string} filename File name without extension.
     * @param {object} options Options for screen cast.
     * @returns {[boolean, string]} Success and the result filename with extension.
     */
    async _screencastAsync(filename, options) {
        return this._screencastCommonAsync (
            global.screen_width, global.screen_height, options,
            this._origProxyScreencast.bind(this._screencastProxy, filename)
        );
    }

    /**
     * Monkey patch for screencast async.
     *
     * Modify option for our configuration.
     *
     * @param {number} x left coordinate of area.
     * @param {number} y top coordinate or area.
     * @param {number} w Width of area.
     * @param {number} h Height of area.
     * @param {string} filename File name without extension.
     * @param {object} options Options for screen cast.
     * @returns {[boolean, string]} Success and the result filename with extension.
     */
    async _screencastAreaAsync(x, y, w, h, filename, options) {
        return this._screencastCommonAsync (w, h, options,
            this._origProxyScreencastArea.bind(this._screencastProxy, x, y, w, h, filename)
        );
    }

    /**
     * Common pre-action and post-action for screen cast request.
     *
     * - Initialize configure.
     * - Modify options (framerate, pipeline)
     * - Fix file name
     * - Print logs
     * - Try next configure if failed.
     *
     * @param {number} width Width of screen cast area.
     * @param {number} height Height of screen cast area.
     * @param {object} options Option for screen cast.
     * @param {(options: object) => Promise<[boolean, string]>} body
     *        An async callback that accepts modified option, and result in file
     *        path and success.
     * @returns {[boolean, string]} Result of body, with fixed file path.
     */
    async _screencastCommonAsync(width, height, options, body) {
        this._partIndicator.onPipelineSetupBegin();
        options['framerate'] = new GLib.Variant('i', this._partAdjust.framerate);
        while (this._pipelineConfigureIndex < this._pipelineConfigures.length) {
            let configure = this._pipelineConfigures[this._pipelineConfigureIndex];

            let pipeline = this._makePipelineString(configure, width, height);
            options['pipeline'] = new GLib.Variant('s', pipeline);

            try {
                var [success, filepath] = await body(options);
                if (success) {
                    this._partIndicator.onPipelineSetupDone();
                    filepath = fixFilePath(filepath, configure.extension);
                }
                return [success, filepath];
            } catch (e) {
                this._pipelineConfigureIndex++;
            }
        }

        // If it reached here, all of pipeline configures are failed.
        throw Error("Tried all configure and failed!");
    }

    /**
     * Perform configuration initialization.
     */
    async _setupPipelineConfigure() {
        this._pipelineConfigures = this._settings.get_value("pipeline-configures").recursiveUnpack().map((tuple) => {
            return {
                "id": tuple[0],
                "videoPrepPipeline": tuple[1],
                "videoPrepDownsizePipeline": tuple[2],
                "videoPipeline": tuple[3],
                "audioPipeline": tuple[4],
                "muxer": tuple[5],
                "extension": tuple[6]
            };
        });
        this._pipelineConfigureIndex = 0;
    }

    /**
     * Make pipeline string for given set of pipeline descriptions.
     *
     * @param {Configure} configure A configure to form pipeline string.
     * @param {number} width Width of screen cast.
     * @param {number} height Height of screen cast.
     * @returns {string} A combined pipeline description.
     */
    _makePipelineString(configure, width, height) {
        var videoSeg = null;
        let video = configure.videoPipeline;
        let muxer = configure.muxer;

        let downsizeRatio = this._partAdjust.downsizeRatio;
        if (downsizeRatio != 1.00) {
            let videoPrep =
                configure.videoPrepDownsizePipeline ||
                configure.videoPrepPipeline;

            let downsizeWidth = Math.floor(width * downsizeRatio);
            let downsizeHeight = Math.floor(height * downsizeRatio);
            let downsizeCap = `video/x-raw(ANY),width=${downsizeWidth},height=${downsizeHeight}`

            videoSeg = `${videoPrep} ! ${downsizeCap} ! ${video} ! ${muxer} name=mux`;
        } else {
            let videoPrep = configure.videoPrepPipeline;

            videoSeg = `${videoPrep} ! ${video} ! ${muxer} name=mux`;
        }
        let audioSource = this._partAudio.makeAudioInput();
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
