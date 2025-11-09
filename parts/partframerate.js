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
import * as PartBase from "./partbase.js"


const FRAMERATES = [15, 24, 30, 60];


/** @extends {PartBase.PartPopupSelect<number>} */
export class PartFramerate extends PartBase.PartPopupSelect {
    constructor (screenshotUI) {
        super(screenshotUI, FRAMERATES, 30);
    }

    /** @override */
    makeLabel(item) {
        return `${item} FPS`;
    }
}
