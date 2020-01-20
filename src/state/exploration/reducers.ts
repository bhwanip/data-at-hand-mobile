import {
  ExplorationStateInfo,
  makeInitialStateInfo,
} from '../../core/interaction/types';
import {ActionTypeBase, ReduxAppState} from '../types';
import {Dispatch} from 'redux';
import {ExplorationStateActionTypes, FinishStateTransition} from './actions';
import {explorationCommandResolver} from '../../core/interaction/ExplorationCommandResolver';
import {ExplorationCommand} from '../../core/interaction/commands';

export interface ExplorationState {
  info: ExplorationStateInfo;
  isProcessing: boolean;
  error: any;
}

const INITIAL_STATE = {
  info: makeInitialStateInfo(),
  isProcessing: false,
  error: null,
} as ExplorationState;

export const explorationStateReducer = (
  state: ExplorationState = INITIAL_STATE,
  action: ActionTypeBase,
): ExplorationState => {
  const newState: ExplorationState = JSON.parse(JSON.stringify(state));

  switch (action.type) {
    case ExplorationStateActionTypes.FinishStateTransition:
      const castedAction = action as FinishStateTransition;
      newState.isProcessing = false;
      if (castedAction.error) {
        newState.error = castedAction.error;
      } else {
        newState.error = null;
        newState.info = castedAction.newStateInfo;
      }
      return newState;
    case ExplorationStateActionTypes.StartStateTransition:
      newState.isProcessing = true;
      return newState;
    default:
      return state;
  }
};

export function resolveExplorationCommand(command: ExplorationCommand) {
  return runAsyncStateUpdateTask((stateInfo: ExplorationStateInfo) => {
    return explorationCommandResolver.getNewStateInfo(stateInfo, command);
  });
}

function runAsyncStateUpdateTask(
  getNewStateFunc: (ExplorationStateInfo) => Promise<ExplorationStateInfo>,
) {
  return async (dispatch: Dispatch, getState: () => ReduxAppState) => {
    dispatch({
      type: ExplorationStateActionTypes.StartStateTransition,
    });
    try {
      const state = getState();
      const newStateInfo = await getNewStateFunc(state.explorationState.info);
      dispatch({
        type: ExplorationStateActionTypes.FinishStateTransition,
        newStateInfo: newStateInfo,
        error: null,
      } as FinishStateTransition);
    } catch (error) {
      console.error(error);
      dispatch({
        type: ExplorationStateActionTypes.FinishStateTransition,
        newStateInfo: null,
        error: error,
      } as FinishStateTransition);
    }
  };
}
