/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

class EventManager {
  constructor() {
    this._registry = new Map();
  }

  unsubscribeAll() {
    this._registry.clear();
  }

  subscribeMulti(names, handler, thisArg) {
    names.forEach((name) => {
      this.subscribe(name, handler.bind(thisArg));
    });
  }

  subscribe(name, handler, once = false) {
    if (!name || !handler) throw new Error("name and handler are required.");
    this._registry.set(handler, { name, once });
    return { unsubscribe: () => this.unsubscribe(name, handler) };
  }

  subscribeSingle(name, handler) {
    if (!name || !handler) throw new Error("name and handler are required.");
    this._registry.forEach((props, handler) => {
      if (props.name === name) this._registry.delete(handler);
    });
    this._registry.set(handler, { name, once: false });
    return { unsubscribe: () => this.unsubscribe(name, handler) };
  }

  unsubscribe(_name, handler) {
    return this._registry.delete(handler);
  }

  publish(name, ...args) {
    this._registry.forEach((props, handler) => {
      if (props.name === name) handler(...args);
      if (props.once) this._registry.delete(handler);
    });
  }

  async publishWithResult(name, ...args) {
    const handlers = [];
    this._registry.forEach((props, handler) => {
      if (props.name === name) handlers.push(handler);
      if (props.once) this._registry.delete(handler);
    });

    if (handlers.length <= 0) return true;
    return await Promise.all(handlers.map((handler) => handler(...args)));
  }

  remove(...names) {
    this._registry.forEach((props, handler) => {
      if (names.includes(props.name)) this._registry.delete(handler);
    });
  }
}
export default EventManager;
