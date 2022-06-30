import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { DDS } from '../../../services/device-detection';
import { eSendEvent, eSubscribeEvent, eUnSubscribeEvent } from '../../../services/event-manager';
import Navigation from '../../../services/navigation';
import { TipManager } from '../../../services/tip-manager';
import { useEditorStore } from '../../../stores/use-editor-store';
import { useTagStore } from '../../../stores/use-tag-store';
import { useThemeStore } from '../../../stores/use-theme-store';
import { db } from '../../../utils/database';
import { MMKV } from '../../../utils/database/mmkv';
import { eOnLoadNote } from '../../../utils/events';
import { tabBarRef } from '../../../utils/global-refs';
import { timeConverter } from '../../../utils/time';
import { NoteType } from '../../../utils/types';
import Commands from './commands';
import { AppState, Content, EditorState, Note, SavePayload } from './types';
import { defaultState, EditorEvents, isEditorLoaded, makeSessionId, post } from './utils';

export const useEditor = (editorId = '', readonly?: boolean) => {
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(makeSessionId());
  const sessionIdRef = useRef(sessionId);
  const editorRef = useRef<WebView>(null);
  const currentNote = useRef<NoteType | null>();
  const currentContent = useRef<Content | null>();
  const timers = useRef<{ [name: string]: NodeJS.Timeout }>({});
  const commands = useMemo(() => new Commands(editorRef), []);
  const sessionHistoryId = useRef<number>();
  const state = useRef<Partial<EditorState>>(defaultState);
  const placeholderTip = useRef(TipManager.placeholderTip());
  const tags = useTagStore(state => state.tags);
  const insets = useSafeAreaInsets();
  const isDefaultEditor = editorId === '';

  const postMessage = useCallback(
    async (type: string, data: any) => await post(editorRef, sessionIdRef.current, type, data),
    [sessionIdRef]
  );

  useEffect(() => {
    commands.setInsets(isDefaultEditor ? insets : { top: 0, left: 0, right: 0, bottom: 0 });
  }, [insets]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    commands.setTags(currentNote.current);
  }, [tags]);

  useEffect(() => {
    let unsub = useThemeStore.subscribe(state => {
      postMessage(EditorEvents.theme, state.colors);
    });

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    console.log('sessionId:', sessionId);
    async () => {
      await commands.setSessionId(sessionId);
      if (sessionId) {
        if (!state.current?.ready) return;
        await onReady();
      }
    };
    return () => {
      state.current.saveCount = 0;
    };
  }, [sessionId, loading]);

  const overlay = (show: boolean, data = { type: 'new' }) => {
    eSendEvent('loadingNote' + editorId, show ? currentNote.current || data : false);
  };

  const onReady = useCallback(async () => {
    if (!(await isEditorLoaded(editorRef, sessionId))) {
      console.log('reload editor');
      overlay(true);
      setLoading(true);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      setLoading(false);
    }
  }, [loading]);

  const withTimer = useCallback((id: string, fn: () => void, duration: number) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(fn, duration);
  }, []);

  const reset = useCallback(async (resetState = true) => {
    currentNote.current?.id && db.fs.cancel(currentNote.current.id);
    currentNote.current = null;
    currentContent.current = null;
    sessionHistoryId.current = undefined;
    await commands.clearContent();
    console.log('reset state: ', resetState);
    if (resetState) {
      isDefaultEditor && useEditorStore.getState().setCurrentlyEditingNote(null);
      placeholderTip.current = TipManager.placeholderTip();
      await commands.setPlaceholder(placeholderTip.current);
    }
  }, []);

  const saveNote = useCallback(
    async ({
      title,
      id,
      data,
      type,
      sessionId: currentSessionId,
      sessionHistoryId: currentSessionHistoryId
    }: SavePayload) => {
      console.log('saving note', id);
      if (readonly) return;
      try {
        if (id && !db.notes?.note(id)) {
          isDefaultEditor && useEditorStore.getState().setCurrentlyEditingNote(null);
          await reset();
          return;
        }
        let note = id ? (db.notes?.note(id)?.data as Note) : null;
        let locked = note?.locked;
        if (note?.conflicted) return;

        let noteData: Partial<Note> = {
          id,
          sessionId: currentSessionHistoryId
        };

        if (title) {
          noteData.title = title;
        }

        if (data) {
          noteData.content = {
            data: data,
            type: type
          };
        }

        if (!locked) {
          id = await db.notes?.add(noteData);
          if (!note && id) {
            currentNote.current = db.notes?.note(id).data as NoteType;
            state.current?.onNoteCreated && state.current.onNoteCreated(id);
          }

          if (useEditorStore.getState().currentEditingNote !== id && isDefaultEditor) {
            setTimeout(() => {
              id && useEditorStore.getState().setCurrentlyEditingNote(id);
            });
          }
        } else {
          //@ts-ignore
          noteData.contentId = note.contentId;
          //@ts-ignore
          await db.vault?.save(noteData);
        }
        if (id && sessionId === currentSessionId) {
          note = db.notes?.note(id)?.data as Note;
          await commands.setStatus(timeConverter(note.dateEdited), 'Saved');

          if (
            currentNote.current?.title !== note.title ||
            currentNote.current?.headline !== note.headline
          ) {
            Navigation.queueRoutesForUpdate('ColoredNotes', 'Notes', 'TaggedNotes', 'TopicNotes');
          }
        }

        return id;
      } catch (e) {
        console.log('error saving: ', e);
      }
    },
    [commands, reset]
  );

  const loadContent = useCallback(async (note: NoteType) => {
    currentNote.current = note;
    if (note.locked || note.content) {
      currentContent.current = {
        data: note.content?.data,
        type: note.content?.type || 'tiny'
      };
    } else {
      currentContent.current = await db.content?.raw(note.contentId);
    }
  }, []);

  const loadNote = useCallback(
    async (item: NoteType) => {
      console.log('loading note', item.type, eOnLoadNote + editorId);
      state.current.currentlyEditing = true;
      const editorState = useEditorStore.getState();

      //@ts-ignore todo
      if (item && item.type === 'new') {
        currentNote.current && (await reset());
        let nextSessionId = makeSessionId(item);
        setSessionId(nextSessionId);
        sessionHistoryId.current = Date.now();
        await commands.setSessionId(nextSessionId);
        await commands.focus();
      } else {
        //@ts-ignore todo
        if (!item.forced && currentNote.current?.id === item.id) return;
        isDefaultEditor && editorState.setCurrentlyEditingNote(item.id);
        overlay(true, item);
        currentNote.current && (await reset(false));
        await loadContent(item);
        let nextSessionId = makeSessionId(item);
        sessionHistoryId.current = item.dateEdited;
        setSessionId(nextSessionId);
        await commands.setSessionId(nextSessionId);
        currentNote.current = item;
        await commands.setStatus(timeConverter(item.dateEdited), 'Saved');
        await postMessage(EditorEvents.title, item.title);
        await postMessage(EditorEvents.html, currentContent.current?.data);
        loadImages();
        await commands.setTags(currentNote.current);
        overlay(false);
      }
    },
    [setSessionId]
  );

  const loadImages = () => {
    if (!currentNote.current?.id) return;
    const images = db.attachments?.ofNote(currentNote.current?.id, 'images');
    if (images && images.length > 0) {
      db.attachments?.downloadImages(currentNote.current.id);
    }
  };

  useEffect(() => {
    eSubscribeEvent(eOnLoadNote + editorId, loadNote);
    return () => {
      eUnSubscribeEvent(eOnLoadNote + editorId, loadNote);
    };
  }, [editorId]);

  const saveContent = useCallback(
    ({ title, content, type }: { title?: string; content?: string; type: string }) => {
      if (type === EditorEvents.content) {
        currentContent.current = {
          data: content,
          type: 'tiny'
        };
      }
      let params = {
        title,
        data: content,
        type: 'tiny',
        sessionId,
        id: currentNote.current?.id,
        sessionHistoryId: sessionHistoryId.current
      };

      withTimer(
        currentNote.current?.id || 'newnote',
        () => {
          if (currentNote.current && !params.id && params.sessionId === sessionId) {
            params.id = currentNote.current?.id;
          }
          saveNote(params);
        },
        500
      );
    },
    []
  );

  const onLoad = useCallback(async () => {
    console.log('on editor load');
    state.current.ready = true;
    onReady();
    postMessage(EditorEvents.theme, useThemeStore.getState().colors);
    commands.setInsets(isDefaultEditor ? insets : { top: 0, left: 0, right: 0, bottom: 0 });
    if (currentNote.current) {
      console.log('force reload note');
      //@ts-ignore
      loadNote({ ...currentNote.current, forced: true });
    } else {
      await commands.setPlaceholder(placeholderTip.current);
      isDefaultEditor && restoreEditorState();
    }
  }, [state, currentNote, loadNote]);

  async function restoreEditorState() {
    let json = await MMKV.getItem('appState');
    if (json) {
      let appState = JSON.parse(json) as AppState;
      if (
        appState.editing &&
        !appState.note?.locked &&
        appState.note?.id &&
        Date.now() < appState.timestamp + 3600000
      ) {
        state.current.isRestoringState = true;
        overlay(true, appState.note);
        state.current.currentlyEditing = true;
        if (!DDS.isTab) {
          tabBarRef.current?.goToPage(1);
        }
        setTimeout(() => {
          console.log('restoring app state here');
          if (appState.note) {
            //@ts-ignore
            loadNote(appState.note);
          }
        }, 1);
        MMKV.removeItem('appState');
        state.current.movedAway = false;
        eSendEvent('load_overlay', 'hide_editor');
        state.current.isRestoringState = false;
        return;
      }
      state.current.isRestoringState = false;
      return;
    }
    state.current.isRestoringState = false;
  }

  return {
    ref: editorRef,
    onLoad,
    commands,
    reset,
    loading,
    setLoading,
    state,
    sessionId,
    setSessionId,
    note: currentNote,
    onReady,
    saveContent,
    editorId: editorId
  };
};
