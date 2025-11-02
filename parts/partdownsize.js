/* partdownsize.js
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

import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as PartBase from "./partbase.js";

const DOWNSIZE_RATIO = [1.00, 0.75, 0.50, 0.33];

export class PartDownsize extends PartBase.PartBase {
    constructor(screenshotUI, showPointerButtonContainer) {
        super();
        
        this.enabled = false;
        this.ratio = 1.00;
        
        this.screenshotUI = screenshotUI;
        this.showPointerButtonContainer = showPointerButtonContainer;
        
        
        this.downsizeButton = new St.Button({
            style_class: "screenshot-ui-show-pointer-button",
            label: "100%",
            visible: false
        });
        this.showPointerButtonContainer.insert_child_at_index(this.downsizeButton, 0);
        
        this.downsizePopupMenu = new PopupMenu.PopupMenu (
            this.downsizeButton,
            0.5,
            St.Side.BOTTOM
        );
        this.downsizePopupMenu.actor.visible = false;
        this.screenshotUI.add_child(this.downsizePopupMenu.actor);
        
        for (let ratio of DOWNSIZE_RATIO) {
            let label = `${ratio * 100}%`;
            this.downsizePopupMenu.addAction(
                label,
                () => {
                    this.ratio = ratio;
                    this.downsizeButton.label = label;
                }
            );
        }
        
        this.downsizeButtonClicked = this.downsizeButton.connect(
            "clicked",
            (_object, _button) => {
                this.downsizePopupMenu.toggle();
            }
        );
    }

    destroy() {
        if (this._showPointerButtonContainer) {
            if (this.downsizeButton) {
                if (this.downsizeButtonClicked) {
                    this.downsizeButton.disconnect(this.downsizeButtonClicked);
                    this.downsizeButtonClicked = null;
                }
                this.showPointerButtonContainer.remove_child(this.downsizeButton);
                this.downsizeButton.destroy();
                this.downsizeButton = null;
            }
            this.showPointerButtonContainer = null;
        }
    }

    set_enabled(enabled) {
        this.enabled = enabled;
        this.downsizeButton.visible = this.enabled;
    }

    /**
     * Get selected ratio.
     *
     * @returns {number} Selected Ratio.
     */
    getRatio() {
        return this.ratio;
    }
}
