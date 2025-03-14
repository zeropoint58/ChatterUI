import { useAppModeState } from '@lib/state/AppMode'
import { Logger } from '@lib/state/Logger'
import { copyFileRes } from 'cui-fs'
import { initLlama, LlamaContext } from 'cui-llama.rn'
import { deleteAsync, documentDirectory, getInfoAsync, makeDirectoryAsync } from 'expo-file-system'
import { create } from 'zustand'

import { Llama } from './Local/LlamaLocal'

type TokenizerState = {
    model?: LlamaContext
    tokenize: (text: string) => number[]
    getTokenCount: (text: string) => number
    loadModel: () => Promise<void>
}

export namespace Tokenizer {
    export const useDefaultTokenizer = create<TokenizerState>()((set, get) => ({
        model: undefined,
        tokenize: (text: string) => {
            return get()?.model?.tokenizeSync(text)?.tokens ?? []
        },
        getTokenCount: (text: string) => {
            const tokens = get()?.model?.tokenizeSync(text)?.tokens?.length ?? 0
            return tokens
        },
        loadModel: async () => {
            if (get().model) return

            const folderDir = `${documentDirectory}appAssets/`
            const folderExists = (await getInfoAsync(folderDir)).exists
            if (!folderExists) await makeDirectoryAsync(`${documentDirectory}appAssets`)

            const modelDir = `${folderDir}llama3tokenizer.gguf`
            const modelExists = (await getInfoAsync(modelDir)).exists
            if (!modelExists) await importModelFromRes()

            const context = await initLlama({
                model: documentDirectory + 'appAssets/llama3tokenizer.gguf',
                vocab_only: true,
                use_mlock: true,
            })
            set((state) => ({ ...state, model: context }))
        },
    }))

    const importModelFromRes = async () => {
        Logger.info('Importing Tokenizer')
        await copyFileRes(
            'llama3tokenizer.gguf',
            documentDirectory + 'appAssets/llama3tokenizer.gguf'
        )
    }

    export const debugDeleteModel = async () => {
        await deleteAsync(documentDirectory + 'appAssets')
    }

    export const getTokenizer = () => {
        return useAppModeState.getState().appMode === 'local'
            ? Llama.useLlama.getState().tokenLength
            : Tokenizer.useDefaultTokenizer.getState().getTokenCount
    }

    export const useTokenizer = () => {
        const defaultTokenizer = useDefaultTokenizer((state) => state.getTokenCount)
        const llamaTokenizer = Llama.useLlama((state) => state.tokenLength)
        const appMode = useAppModeState((state) => state.appMode)
        return appMode === 'local' ? llamaTokenizer : defaultTokenizer
    }
}

Tokenizer.useDefaultTokenizer.getState().loadModel()
