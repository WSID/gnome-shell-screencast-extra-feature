/* partquickstop.js
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

import * as PartBase from "./partbase.js";

// Copied from Gnome Shell source.
const UIMode = {
    SCREENSHOT: 0,
    SCREENCAST: 1,
    SCREENSHOT_ONLY: 2,
};

/**
 * Quick Stop Feature.
 *
 * If screen cast is ongoing, you can press <keys>Ctrl + Alt + Shift + R</key>
 * to quickly stop screen cast.
 */
export class PartQuickStop extends PartBase.PartBase {
    constructor(screenshotUI) {
        super();
        this.screenshotUI = screenshotUI;

        // Monkey-patch
        this.origScreenshotUIOpen = this.screenshotUI.open;
        this.screenshotUI.open = this._screenshotUIOpen.bind(this);
    }

    destroy() {
        if (this.screenshotUI) {
            this.screenshotUI.open = this.origScreenshotUIOpen;
            this.screenshotUI = null;
        }
    }

    /**
     * Override of screenshotUI.open(..)
     *
     * @param {number} uiMode A UI Mode.
     */
    async _screenshotUIOpen(uiMode) {
        let isToStop =
            (uiMode === UIMode.SCREENCAST) &&
            this.screenshotUI._screencastInProgress;

        if (isToStop) {
            await this.screenshotUI.stopScreencast();
        } else {
            await this.origScreenshotUIOpen.call(this.screenshotUI, uiMode);
        }
    }
}
