import { useState, useEffect, useMemo } from 'react';
import type { RisuCharacter } from '../../types/risuai';
import type { GlobalSettings } from '../../types';
import type { UIClassInfo } from '../utils/domUtils';
import type { LogExporterSettings } from './types';
import { processChatLog, serializeNodes } from '../../services/chatData';
import { collectUIClasses, filterWithCustomClasses, getNameFromNode } from '../utils/domUtils';
import { CHAT_CONTENT_SELECTOR } from '../components/constants';
import type { CharInfoState } from './types';

interface UseLogDataOptions {
  startIndex?: number;
  endIndex?: number;
  singleMessage?: boolean;
}

/**
 * Parse HTML strings back to HTMLElement[] using a proper DOMParser approach.
 */
function parseHtmlToElements(htmlStrings: string[]): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  for (const html of htmlStrings) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    if (tmp.firstElementChild) {
      nodes.push(tmp.firstElementChild as HTMLElement);
    } else {
      nodes.push(tmp);
    }
  }
  return nodes;
}

export function useLogData(options: UseLogDataOptions, globalSettings: GlobalSettings) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [charInfo, setCharInfo] = useState<CharInfoState>({
    charName: '',
    chatName: '',
    charAvatarUrl: '',
  });
  const [messageNodes, setMessageNodes] = useState<HTMLElement[]>([]);
  const [character, setCharacter] = useState<RisuCharacter | null>(null);
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [uiClasses, setUiClasses] = useState<UIClassInfo[]>([]);
  const [preCollectedAvatarMap, setPreCollectedAvatarMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const {
          charName,
          chatName,
          charAvatarUrl,
          messageNodes: safeNodes,
          character,
          avatarMap,
        } = await processChatLog(undefined, options);

        if (cancelled) return;

        const htmlStrings = await serializeNodes(safeNodes);
        const nodes = parseHtmlToElements(htmlStrings);

        setCharInfo({ charName, chatName, charAvatarUrl });
        setMessageNodes(nodes);
        setCharacter(character);

        const mapObj = new Map<string, string>();
        if (avatarMap) {
          Object.entries(avatarMap).forEach(([k, v]) => mapObj.set(k, String(v)));
        }
        setPreCollectedAvatarMap(mapObj);

        const newParticipants = new Set<string>();
        nodes.forEach((node: HTMLElement) => {
          const name = getNameFromNode(node, globalSettings, charName);
          if (name) newParticipants.add(name);
        });
        setParticipants(newParticipants);
        setUiClasses(collectUIClasses(nodes));
      } catch (err: unknown) {
        if (cancelled) return;
        const error_msg = err instanceof Error ? err.stack || err.message : String(err);
        console.error('[Log Exporter] Modal open error:', err);
        setError(error_msg);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [options, globalSettings]);

  return {
    isLoading,
    error,
    charInfo,
    messageNodes,
    character,
    participants,
    uiClasses,
    preCollectedAvatarMap,
    setMessageNodes,
    setCharacter,
  };
}

/**
 * Memoized filtered nodes based on custom filters and participant filtering.
 */
export function useFilteredNodes(
  messageNodes: HTMLElement[],
  settings: LogExporterSettings,
  globalSettings: GlobalSettings,
  charName: string,
): HTMLElement[] {
  return useMemo(() => {
    const activeFilters = settings.customFilters
      ? Object.entries(settings.customFilters).filter(([, checked]) => checked).map(([key]) => key)
      : [];

    return messageNodes
      .map(node => {
        if (activeFilters.length > 0) {
          return filterWithCustomClasses(node, activeFilters, globalSettings);
        }
        return node;
      })
      .filter(node => {
        const isMessageNode = node.querySelector(CHAT_CONTENT_SELECTOR);
        if (isMessageNode) {
          const name = getNameFromNode(node as HTMLElement, globalSettings, charName);
          if (globalSettings?.filteredParticipants?.includes(name)) {
            return false;
          }
        }
        return true;
      });
  }, [messageNodes, settings.customFilters, globalSettings, charName]);
}
