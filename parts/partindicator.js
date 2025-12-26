/* partindicator.js
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

import GLib from "gi://GLib";

import * as Animation from 'resource:///org/gnome/shell/ui/animation.js';

import * as PartBase from "./partbase.js";

export class PartIndicator extends PartBase.PartBase {
    constructor(screenshotUI, screenRecordingIndicator) {
        super();

        this.screenshotUI = screenshotUI;
        this.screenRecordingIndicator = screenRecordingIndicator;
        this.screenRecordingIndicatorBox = this.screenRecordingIndicator._box;
        this.screenRecordingIndicatorLabel = this.screenRecordingIndicator._label;
        this.screenRecordingIndicatorLabel.visible = false;

        // UI
        this.pipelineSpinner = new Animation.Spinner(16, {hideOnStop: true});

        this.screenRecordingIndicatorBox.insert_child_at_index(this.pipelineSpinner, 0);
    }

    /** @override */
    destroy() {
        if (this.screenRecordingIndicator) {
            // Teardown UI
            if (this.pipelineSpinner) {
                this.screenRecordingIndicatorBox.remove_child(this.pipelineSpinner);
                this.pipelineSpinner.destroy();
                this.pipelineSpinner = null;
            }

            this.screenRecordingIndicatorLabel.visible = true;
            this.screenRecordingIndicatorLabel = null;
            this.screenRecordingIndicatorBox = null;
            this.screenRecordingIndicator = null;
        }

        this.screenshotUI = null;
    }

    onPipelineSetupBegin() {
        this.pipelineSpinner.play();
        this.screenRecordingIndicatorLabel.visible = false;
    }

    onPipelineSetupDone() {
        this.pipelineSpinner.stop();
        this.screenRecordingIndicatorLabel.visible = true;

        if (this.screenshotUI.screencast_in_progress) {
            // Stop time counting of indicator by removing the timeout,
            // and restart time count again.

            GLib.Source.remove(this.screenRecordingIndicator._timeoutId);
            this.screenRecordingIndicator._onScreencastInProgressChanged();
        }
    }

}
