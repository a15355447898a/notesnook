import { createRef, MutableRefObject, RefObject } from 'react';
import { Platform } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { db } from '../../../utils/database';
import { sleep } from '../../../utils/time';
import { Note } from './types';
import { getResponse, randId, textInput } from './utils';

type Action = { job: string; id: string };

export type Settings = {
  readonly: boolean;
  fullscreen: boolean;
  deviceMode: string;
  premium: boolean;
};

async function call(webview: RefObject<WebView | undefined>, action?: Action) {
  if (!webview.current || !action) return;
  setImmediate(() => webview.current?.injectJavaScript(action.job));
  let response = await getResponse(action.id);
  console.log('webview job: ', action.id, response ? response.value : response);
  if (!response) {
    console.warn('webview job failed', action.id, action.job);
  }
  return response ? response.value : response;
}

const fn = (fn: string) => {
  let id = randId('fn_');
  return {
    job: `(async () => {
      try {
        let response = true;
        ${fn}
        post("${id}",response);
      } catch(e) {
        logger('error', "webview: ", e.message, e.stack);
      }
    })();`,
    id: id
  };
};

class Commands {
  ref = createRef<WebView | undefined>();
  constructor(ref: MutableRefObject<WebView | undefined>) {
    this.ref = ref;
  }

  focus = async () => {
    if (!this.ref) return;
    if (Platform.OS === 'android') {
      this.ref.current?.requestFocus();
      setTimeout(async () => {
        if (!this.ref) return;
        textInput.current?.focus();
        this.ref?.current?.requestFocus();
        await call(this.ref, fn(`editor.commands.focus()`));
      }, 1);
    } else {
      await sleep(200);
      await call(this.ref, fn(`editor.commands.focus()`));
    }
  };

  blur = async () => await call(this.ref, fn(`editor.commands.blur();editorTitle.current?.blur()`));

  clearContent = async () => {
    await call(
      this.ref,
      fn(
        `
editor.commands.blur();
editorTitle.current?.blur();
editor?.commands.clearContent(false);
editorController.setTitle(null);
statusBar.current.set({date:"",saved:""});
        `
      )
    );
  };

  setSessionId = async (id: string | null) =>
    await call(this.ref, fn(`globalThis.sessionId = "${id}"`));

  setStatus = async (date: string | undefined, saved: string) =>
    await call(this.ref, fn(`statusBar.current.set({date:"${date}",saved:"${saved}"})`));

  setPlaceholder = async (placeholder: string) => {
    await call(
      this.ref,
      fn(`
    const element = document.querySelector(".is-editor-empty");
    if (element) {
      element.setAttribute("data-placeholder","${placeholder}");
    }
    `)
    );
  };

  setInsets = async (insets: EdgeInsets) => {
    logger.info('setInsets', insets);
    await call(
      this.ref,
      fn(`
      if (typeof safeAreaController !== "undefined") {
        safeAreaController.update(${JSON.stringify(insets)}) 
      }
    `)
    );
  };

  setSettings = async (settings: Partial<Settings>) => {
    await call(
      this.ref,
      fn(`
      if (typeof globalThis.settingsController !== "undefined") {
        globalThis.settingsController.update(${JSON.stringify(settings)}) 
      }
    `)
    );
  };

  setTags = async (note: Note | null | undefined) => {
    if (!note) return;
    let tags = note.tags
      .map((t: any) =>
        db.tags?.tag(t) ? { title: db.tags.tag(t).title, alias: db.tags.tag(t).alias } : null
      )
      .filter((t: any) => t !== null);
    await call(
      this.ref,
      fn(`
      if (typeof editorTags !== "undefined" && editorTags.current) {
        editorTags.current.setTags(${JSON.stringify(tags)});
      }
    `)
    );
  };
}

export default Commands;
