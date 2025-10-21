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

import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class ScreencastWithAudio extends Extension {
    enable() {
        // Reference from Main UI
        this._screenshotUI = Main.screenshotUI;
        this._showPointerButtonContainer = this._screenshotUI._showPointerButtonContainer;
        this._showPointerButton = this._screenshotUI._showPointerButton;
        this._shotButton = this._screenshotUI._shotButton;

        // Created widgets
        this._desktopAudioButton = new St.Button({
          style_class: 'screenshot-ui-show-pointer-button',
          icon_name: 'audio-speakers-symbolic',
          toggle_mode: true,
          visible: ! this._shotButton.checked
        });
        this._micAudioButton = new St.Button({
          style_class: 'screenshot-ui-show-pointer-button',
          icon_name: 'audio-input-microphone-symbolic',
          toggle_mode: true,
          visible: ! this._shotButton.checked
        });

        // Add widgets
        this._showPointerButtonContainer.insert_child_at_index(
          this._desktopAudioButton,
          0
        );
        this._showPointerButtonContainer.insert_child_at_index(
          this._micAudioButton,
          1
        );

        // connect to signals.
        this._shotButtonNotifyChecked = this._shotButton.connect (
          'notify::checked',
          (_object, _pspec) => {
            this._desktopAudioButton.visible = ! this._shotButton.checked
            this._micAudioButton.visible = ! this._shotButton.checked
          }
        );
    }

    disable() {
        this._shotButton.disconnect(this._shotButtonNotifyChecked);
        this._showPointerButtonContainer.remove_child(this._desktopAudioButton);
        this._showPointerButtonContainer.remove_child(this._micAudioButton);
    }
}
