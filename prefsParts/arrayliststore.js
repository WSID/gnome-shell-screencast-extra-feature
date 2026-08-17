/* arrayliststore.js
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

import Gio from "gi://Gio";
import GObject from "gi://GObject";

/**
 * A supplement object to carry javascript value as GObject.
 *
 * Used with Gio.ListModel.
 *
 * @class
 */
export const ValueHolder = GObject.registerClass(
    { GTypeName: "ValueHolder" },
    /**
     * @template T Type of stored element.
     * @lends ValueHolder.prototype
     * @property {T} value A value.
     */
    class ValueHolder extends GObject.Object {
        constructor(params) {
            super(params);
            this.value = null;
        }

        /**
         * @param {T} value
         * @returns {ValueHolder<T>} holder
         */
        static of (value) {
            const holder = new ValueHolder({});
            holder.value = value;
            return holder;
        }
    }
);


/**
 * A Gio List Model that hold javascript values.
 *
 * Internally, holds #ValueHolder to return GObject.
 *
 * @class
 */
export const ArrayListStore = GObject.registerClass(
    {
        GTypeName: "ArrayListStore",
        Implements: [Gio.ListModel],
    },
    /**
     * @template T Type of stored element.
     * @lends ArrayListStore
     * @implements {Gio.ListModel}
     * @implements {Iterable<T>}
     */
    class ArrayListStore extends GObject.Object {
        constructor(params) {
            super(params);

            /** @type {ValueHolder<T>[]} */
            this._inner = Array();
        }

        // Itearble protocol

        /**
         * @returns {Generator<T>}
         */
        *[Symbol.iterator]() {
            for (const holder of this._inner) {
                yield holder.value;
            }
        }

        // Gio.ListModel

        /**
         * @override
         * @param {number} position
         * @returns {?GObject.Object}
         */
        vfunc_get_item(position) {
            if (position < this._inner.length) {
                return this._inner[position];
            } else {
                return null;
            }
        }

        /**
         * @override
         * @returns {GObject.Type}
         */
        vfunc_get_item_type() {
            return ValueHolder;
        }

        /**
         * @override
         * @returns {number}
         */
        vfunc_get_n_items() {
            return this._inner.length;
        }

        // Array like interface

        /**
         * @param {number} index
         * @returns {?T}
         */
        at(index) {
            const result = this._inner.at(index)
            if (result != null) {
                return result.value;
            } else {
                return null;
            }
        }

        /**
         * @param {T} searchElement
         * @param {number} fromIndex
         */
        indexOf(searchElement) {
            return this._inner.findIndex((v) => v.value === searchElement);
        }

        /**
         * @param {T} item
         * @returns {boolean}
         */
        includes(item, fromStart = 0) {
            var actualStart = fromStart;
            if (actualStart < 0) actualStart = this._inner.length - actualStart;
            for (var i = actualStart; i < this._inner.length ; i++) {
                if (this._inner[i].value == item) return true
            }
            return false;
        }

        /**
         * @param {T} value A value to push
         * @returns {number} New length
         */
        push(value) {
            const position = this._inner.length;
            const new_length = this._inner.push (ValueHolder.of(value));
            this.emit("items-changed", position, 0, 1);

            return new_length
        }

        /**
         * @param {number} start
         * @param {number} deleteCount
         * @param {...T} items
         * @returns {T[]} Removed items.
         */
        splice(start, deleteCount, ...items) {
            const length = this._inner.length;

            // We need to calculate actual spliced range to signal items-changed.
            var actualStart = start;
            if (actualStart < 0) actualStart = length - actualStart;
            if (actualStart > length) actualStart = length;

            const maxDeleteCount = length - actualStart;
            var actualDeleteCount = deleteCount;
            if (actualDeleteCount === undefined || actualDeleteCount > maxDeleteCount) {
                actualDeleteCount = maxDeleteCount
            } else if (actualDeleteCount < 0) {
                actualDeleteCount = 0
            }

            if (actualDeleteCount == 0 && items.length == 0) {
                return [];
            }

            const itemObjects = items.map (ValueHolder.of);
            const result = this._inner.splice(actualStart, actualDeleteCount, ...itemObjects);
            this.emit("items-changed", actualStart, actualDeleteCount, items.length);
            return result.map (r => r.value);
        }

        /**
         * @template U
         * @param {function(T, number, ArrayListStore<T>):U} func
         * @returns {U[]}
         */
        map(func) {
            return this._inner.map((holder, index, _) => func(holder.value, index, this));
        }

        // Utility functions

        /**
         * Inserts value sorted.
         *
         * compareFunc can be omitted, and simple comparison feature is used.
         *
         * @param {T} value A value to insert.
         * @param {function(T,T):number} compareFunc Comparison between items.
         */
        insert_sorted(value, compareFunc) {
            var actualCompareFunc = compareFunc;
            if (!compareFunc) actualCompareFunc = (a, b) => {
                if (a < b) return -1;
                else if (a > b) return 1;
                return 0;
            }

            for (var i = 0; i < this._inner.length; i++) {
                if (actualCompareFunc(value, this._inner[i].value) < 0) {
                    this.splice(i, 0, value);
                    return;
                }
            }

            this.push(value);
        }
    }
)
