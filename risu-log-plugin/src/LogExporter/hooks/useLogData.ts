import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { RisuCharacter } from '../../types/risuai';
import type { GlobalSettings } from '../../types';
import type { UIClassInfo } from '../utils/domUtils';
import type { LogExporterSettings, CharInfoState } from './types';
import { processChatLog, serializeNodes } from '../../services/chatData';
import { collectUIClasses, filterWithCustomClasses, getNameFromNode } from '../utils/domUtils';
import { CHAT_CONTENT_SELECTOR } from '../components/constants';

// Re-export CharInfoState for consumers of this hook module
export type { CharInfoState } from './types';

export interface UseLogDataOptions {
  startIndex?: number;
  endIndex?: number;
  singleMessage?: boolean;
}

export interface UseLogDataResult {
  isLoading: boolean;
  error: string | null;
  charInfo: CharInfoState;
  messageNodes: HTMLElement[];
  character: RisuCharacter | null;
  participants: Set<string>;
  uiClasses: UIClassInfo[];
  preCollectedAvatarMap: Map<string, string>;
  setMessageNodes: Dispatch<SetStateAction<HTMLElement[]>>;
  setCharacter: Dispatch<SetStateAction<RisuCharacter | null>>;
}

/** Initial empty state for character information */
const INITIAL_CHAR_INFO: CharInfoState = {
  charName: '',
  chatName: '',
  charAvatarUrl: '',
};

/**
 * Parses an array of HTML strings back into an array of HTMLElement DOM nodes.
 *
 * @param htmlStrings Array of serialized HTML string representations
 * @returns Array of parsed HTMLElement instances
 */
export function parseHtmlToElements(htmlStrings: string[]): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  for (const html of htmlStrings) {
    const container = document.createElement('div');
    container.innerHTML = html;
    if (container.firstElementChild) {
      nodes.push(container.firstElementChild as HTMLElement);
    } else {
      nodes.push(container);
    }
  }
  return nodes;
}

/**
 * Converts a raw avatar record dictionary into a Map instance.
 */
function createAvatarMap(avatarRecord?: Record<string, string>): Map<string, string> {
  const avatarMap = new Map<string, string>();
  if (avatarRecord) {
    for (const [key, value] of Object.entries(avatarRecord)) {
      if (value != null) {
        avatarMap.set(key, String(value));
      }
    }
  }
  return avatarMap;
}

/**
 * Collects unique participant names from the parsed message DOM nodes.
 */
function collectParticipantNames(
  nodes: HTMLElement[],
  globalSettings: GlobalSettings,
  charName: string,
): Set<string> {
  const participants = new Set<string>();
  for (const node of nodes) {
    const name = getNameFromNode(node, globalSettings, charName);
    if (name) {
      participants.add(name);
    }
  }
  return participants;
}

/**
 * Formats an unknown error into a descriptive error message string.
 */
function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.stack || err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return String(err);
}

/**
 * Custom hook to load, parse, and manage chat log data, character metadata,
 * message DOM nodes, and participant mappings.
 *
 * @param options Index range or single-message filter options
 * @param globalSettings User's global plugin configuration
 * @returns State and controls for the loaded log data
 */
export function useLogData(
  options: UseLogDataOptions,
  globalSettings: GlobalSettings,
): UseLogDataResult {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [charInfo, setCharInfo] = useState<CharInfoState>(INITIAL_CHAR_INFO);
  const [messageNodes, setMessageNodes] = useState<HTMLElement[]>([]);
  const [character, setCharacter] = useState<RisuCharacter | null>(null);
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [uiClasses, setUiClasses] = useState<UIClassInfo[]>([]);
  const [preCollectedAvatarMap, setPreCollectedAvatarMap] = useState<Map<string, string>>(new Map());

  // Extract primitive option values to avoid unnecessary re-fetches when options object reference changes
  const { startIndex, endIndex, singleMessage } = options;

  useEffect(() => {
    let isCancelled = false;

    const loadChatData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const processOptions: UseLogDataOptions = {
          startIndex,
          endIndex,
          singleMessage,
        };

        const {
          charName,
          chatName,
          charAvatarUrl,
          messageNodes: safeNodes,
          character: loadedCharacter,
          avatarMap: rawAvatarMap,
        } = await processChatLog(undefined, processOptions);

        if (isCancelled) return;

        // Serialize and reconstruct safe DOM elements for preview / export
        const htmlStrings = await serializeNodes(safeNodes);
        if (isCancelled) return;

        const parsedNodes = parseHtmlToElements(htmlStrings);
        const avatarMap = createAvatarMap(rawAvatarMap);
        const foundParticipants = collectParticipantNames(parsedNodes, globalSettings, charName);
        const collectedUIClasses = collectUIClasses(parsedNodes);

        if (isCancelled) return;

        setCharInfo({ charName, chatName, charAvatarUrl });
        setMessageNodes(parsedNodes);
        setCharacter(loadedCharacter);
        setPreCollectedAvatarMap(avatarMap);
        setParticipants(foundParticipants);
        setUiClasses(collectedUIClasses);
      } catch (err: unknown) {
        if (isCancelled) return;
        const errorMessage = formatErrorMessage(err);
        console.error('[Log Exporter] Failed to load chat log data:', err);
        setError(errorMessage);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadChatData();

    return () => {
      isCancelled = true;
    };
  }, [startIndex, endIndex, singleMessage, globalSettings]);

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
 * Checks whether a given message node belongs to a participant that should be filtered out.
 */
function shouldFilterNodeByParticipant(
  node: HTMLElement,
  globalSettings: GlobalSettings,
  charName: string,
): boolean {
  const filteredParticipants = globalSettings?.filteredParticipants;
  if (!filteredParticipants || filteredParticipants.length === 0) {
    return false;
  }

  const isMessageNode =
    (node.matches && node.matches(CHAT_CONTENT_SELECTOR)) ||
    node.querySelector(CHAT_CONTENT_SELECTOR) !== null;

  if (!isMessageNode) {
    return false;
  }

  const name = getNameFromNode(node, globalSettings, charName);
  return filteredParticipants.includes(name);
}

/**
 * Memoized hook to filter message DOM nodes based on active custom CSS class filters
 * and excluded participants from global settings.
 *
 * @param messageNodes Raw message DOM elements
 * @param settings Exporter settings containing custom filter toggles
 * @param globalSettings Global plugin settings containing excluded participant names
 * @param charName Active character name for fallback participant name resolution
 * @returns Filtered and transformed message DOM elements
 */
export function useFilteredNodes(
  messageNodes: HTMLElement[],
  settings: LogExporterSettings,
  globalSettings: GlobalSettings,
  charName: string,
): HTMLElement[] {
  // Extract only enabled custom filter class names
  const activeFilters = useMemo(() => {
    if (!settings.customFilters) return [];
    return Object.entries(settings.customFilters)
      .filter(([, isEnabled]) => Boolean(isEnabled))
      .map(([filterKey]) => filterKey);
  }, [settings.customFilters]);

  return useMemo(() => {
    if (messageNodes.length === 0) {
      return [];
    }

    return messageNodes
      .map((node) => {
        if (activeFilters.length > 0) {
          return filterWithCustomClasses(node, activeFilters, globalSettings);
        }
        return node;
      })
      .filter((node) => !shouldFilterNodeByParticipant(node, globalSettings, charName));
  }, [messageNodes, activeFilters, globalSettings, charName]);
}

