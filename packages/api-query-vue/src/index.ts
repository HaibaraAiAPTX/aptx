import { toValue } from "vue";
import { useMutation, useQuery } from "@tanstack/vue-query";
import type {
  UseMutationOptions,
  UseMutationReturnType,
  UseQueryOptions,
  UseQueryReturnType,
} from "@tanstack/vue-query";
import type { MaybeRefOrGetter } from "vue";
import type {
  MutationDefinition,
  QueryDefinition,
  QueryFunctionContextLike,
  QueryKey,
} from "@aptx/api-query-adapter";

export interface VueQueryHooks<TInput, TOutput, TError = Error> {
  useAptxQuery: (
    input: MaybeRefOrGetter<TInput>,
    options?: {
      query?: Omit<
        UseQueryOptions<TOutput, TError, TOutput, QueryKey>,
        "queryKey" | "queryFn"
      >;
    }
  ) => UseQueryReturnType<TOutput, TError>;
}

export function createVueQueryHooks<TInput, TOutput, TError = Error>(
  def: QueryDefinition<TInput, TOutput>
): VueQueryHooks<TInput, TOutput, TError> {
  return {
    useAptxQuery(input, options) {
      return useQuery<TOutput, TError, TOutput, QueryKey>({
        queryKey: def.key(toValue(input)),
        queryFn: (ctx) =>
          def.queryFn(toValue(input))(ctx as QueryFunctionContextLike & { queryKey: QueryKey }),
        ...(options?.query ?? {}),
      });
    },
  };
}

export interface VueMutationHooks<TInput, TOutput, TError = Error> {
  useAptxMutation: (
    options?: {
      mutation?: Omit<UseMutationOptions<TOutput, TError, TInput, unknown>, "mutationFn">;
    }
  ) => UseMutationReturnType<TOutput, TError, TInput, unknown>;
}

export function createVueMutationHooks<TInput, TOutput, TError = Error>(
  def: MutationDefinition<TInput, TOutput>
): VueMutationHooks<TInput, TOutput, TError> {
  return {
    useAptxMutation(options) {
      return useMutation<TOutput, TError, TInput, unknown>({
        mutationFn: def.mutationFn,
        ...(options?.mutation ?? {}),
      });
    },
  };
}
