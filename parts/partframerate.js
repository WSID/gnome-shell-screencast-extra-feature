/* partframerate.js
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

import * as PartBase from "./partbase.js"


const FRAMERATES = [15, 24, 30, 60];


export class PartFramerate extends PartBase.PartBase {
    constructor (screenshotUI, showPointerButtonContainer) {
        super();

        this.enabled = false;
        this.framerate = 30;

        this.screenshotUI = screenshotUI;
        this.showPointerButtonContainer = showPointerButtonContainer;

        this.framerateButton = new St.Button({
            style_class: 'screenshot-ui-show-pointer-button',
            label: "30 FPS",
            visible: false
        });
        this.showPointerButtonContainer.insert_child_at_index(this.framerateButton, 0);

        this.frameratePopupMenu = new PopupMenu.PopupMenu(
            this.framerateButton,
            0.5,
            St.Side.BOTTOM
        );
        this.frameratePopupMenu.actor.visible = false;
        this.screenshotUI.add_child(this.frameratePopupMenu.actor);

        for (let framerate of FRAMERATES) {
            let label = `${framerate} FPS`;
            this.frameratePopupMenu.addAction(
                label,
                () => {
                    this.framerate = framerate;
                    this.framerateButton.label = label;
                }
            );
        }

        this.framerateButtonClicked = this.framerateButton.connect(
            'clicked',
            (_object, _button) => {
                this.frameratePopupMenu.toggle();
            }
        );
    }

    destroy() {
        if (this.showPointerButtonContainer) {
            if (this.framerateButton) {
                if (this.framerateButtonClicked) {
                    this.framerateButton.disconnect(this.framerateButtonClicked);
                    this.framerateButtonClicked = null;
                }
                this.showPointerButtonContainer.remove_child(this.framerateButton);
                this.framerateButton.destroy();
                this.framerateButton = null;
            }
            this.showPointerButtonContainer = null;
        }
    }

    set_enabled(enabled) {
        this.enabled = enabled;
        this.framerateButton.visible = this.enabled;
    }

    get_framerate() {
        return this.framerate;
    }
}
