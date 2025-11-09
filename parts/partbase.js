/* partbase.js
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




/**
 * A base class for part of this extension.
 */
export class PartBase {
    /**
     * Function for teardown.
     */
    destroy() {
    }
}

/**
 * A base class for part, that adds UI on here.
 */
export class PartUI extends PartBase {

    /**
     * Construct part with screenshot UI.
     *
     * @param screenshotUI a screenshot UI.
     */
    constructor(screenshotUI) {
        super();

        this.castModeSelected = false;

        this.screenshotUI = screenshotUI;
        this.shotButton = this.screenshotUI._shotButton;

        this.shotButtonNotifyChecked = this.shotButton.connect (
            "notify::checked",
            (_object, _pspec) => {
                this.castModeSelected = !this.shotButton.checked;
                this.onCastModeSelected(this.castModeSelected);
            }
        );
    }

    /** @override */
    destroy() {
        if (this.shotButton && this.shotButtonNotifyChecked) {
            this.shotButton.disconnect(this.shotButtonNotifyChecked);
        }

        this.shotButton = null;
        this.screenshotUI = null;

        this.castModeSelected = false;

        super.destroy();
    }

    /**
     * Called when the cast mode selection is changed.
     *
     * @param {boolean} selected Whether the cast mode is selected.
     */
    onCastModeSelected(selected) {
        // Empty.
    }

    /**
     * Get cast mode selected.
     *
     * @returns {boolean} Whether the cast mode is selected.
     */
    getCastModeSelected() {
        return this.castModeSelected;
    }
}

