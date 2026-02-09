import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import type {
  MutationDefinition,
  QueryDefinition,
  QueryFunctionContextLike,
  QueryKey,
} from "@aptx/api-query-adapter";

export interface ReactQueryHooks<TInput, TOutput, TError = Error> {
  useAptxQuery: (
    input: TInput,
    options?: {
      query?: Omit<
        UseQueryOptions<TOutput, TError, TOutput, QueryKey>,
        "queryKey" | "queryFn"
      >;
    }
  ) => UseQueryResult<TOutput, TError>;
}

export function createReactQueryHooks<TInput, TOutput, TError = Error>(
  def: QueryDefinition<TInput, TOutput>
): ReactQueryHooks<TInput, TOutput, TError> {
  return {
    useAptxQuery(input, options) {
      return useQuery<TOutput, TError, TOutput, QueryKey>({
        queryKey: def.key(input),
        queryFn: (ctx) => def.queryFn(input)(ctx as QueryFunctionContextLike & { queryKey: QueryKey }),
        ...(options?.query ?? {}),
      });
    },
  };
}

export interface ReactMutationHooks<TInput, TOutput, TError = Error> {
  useAptxMutation: (
    options?: {
      mutation?: Omit<UseMutationOptions<TOutput, TError, TInput, unknown>, "mutationFn">;
    }
  ) => UseMutationResult<TOutput, TError, TInput, unknown>;
}

export function createReactMutationHooks<TInput, TOutput, TError = Error>(
  def: MutationDefinition<TInput, TOutput>
): ReactMutationHooks<TInput, TOutput, TError> {
  return {
    useAptxMutation(options) {
      return useMutation<TOutput, TError, TInput, unknown>({
        mutationFn: def.mutationFn,
        ...(options?.mutation ?? {}),
      });
    },
  };
}
