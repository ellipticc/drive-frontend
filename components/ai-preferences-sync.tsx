"use client"

import { useEffect, useRef } from 'react'
import { useUser } from '@/components/user-context'
import { apiClient } from '@/lib/api'
import { getAIPreferences, saveAIPreferences } from '@/lib/ai-preferences-db'
import { getDevicePublicKey, signWithDeviceKey } from '@/lib/device-keys'
import { masterKeyManager } from '@/lib/master-key'
import { toast } from 'sonner' // Assuming sonner is available
import { usePathname } from 'next/navigation' // To re-check on nav

export function AIPreferencesSync() {
    const { user } = useUser()
    const pathname = usePathname()
    const syncingRef = useRef(false)
    const hasSyncedRef = useRef(false) // Only sync once per mount/login unless forced

    // Main sync function
    const syncPreferences = async () => {
        if (syncingRef.current) return
        syncingRef.current = true

        try {
            console.log('AI Sync: Starting sync check...')

            // 1. Prerequisites check
            if (!masterKeyManager.hasMasterKey()) {
                console.log('AI Sync: No master key available locally (not logged in?), skipping')
                syncingRef.current = false
                return
            }

            // 2. Encrypted local preferences
            const localEncrypted = await getAIPreferences()
            let localHash = ''

            // Calculate local hash for comparison
            if (localEncrypted) {
                const encoder = new TextEncoder()
                const data = encoder.encode(localEncrypted)
                const hashBuffer = await crypto.subtle.digest('SHA-256', data)
                const hashArray = Array.from(new Uint8Array(hashBuffer))
                localHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
            } else {
                console.log('AI Sync: No local preferences found.')
            }

            // 3. Fetch remote preferences metadata (hash)
            const remoteRes = await apiClient.getIndexedDbPreferences()

            if (remoteRes.success && remoteRes.data && remoteRes.data.settings) {
                const remoteHash = remoteRes.data.hash

                // 4. Compare hashes
                if (remoteHash && remoteHash !== localHash) {
                    console.log('AI Sync: Remote hash differs from local. Downloading remote preferences.')
                    // Remote is source of truth on sync mismatch (for now "server wins" policy)
                    await saveAIPreferences(remoteRes.data.settings)
                    toast.success('AI Preferences synced from cloud')
                } else {
                    console.log('AI Sync: Local and Remote are in sync.')
                }
            } else {
                // Remote has no data, but we have local data -> Upload local
                if (localEncrypted && localHash) {
                    console.log('AI Sync: No remote preferences found. Uploading local.')

                    const deviceId = await getDevicePublicKey()
                    if (!deviceId) {
                        console.warn('AI Sync: Cannot upload without device ID (for signing).')
                        syncingRef.current = false
                        return
                    }

                    const signature = await signWithDeviceKey(localHash)
                    if (signature) {
                        await apiClient.storeIndexedDbPreferences({
                            settings: localEncrypted,
                            hash: localHash,
                            signature,
                            deviceId
                        })
                        toast.success('AI Preferences backed up to cloud')
                    }
                }
            }

            hasSyncedRef.current = true

        } catch (e) {
            console.error('AI Sync failed:', e)
        } finally {
            syncingRef.current = false
        }
    }

    // Effect to listen for login event
    useEffect(() => {
        const handleLogin = () => {
            console.log('AI Sync: User login detected. Scheduling sync.')
            hasSyncedRef.current = false
            syncPreferences()
        }

        const handleSyncEvent = () => {
            console.log('AI Sync: Manual sync triggered.')
            syncPreferences()
        }

        window.addEventListener('user-login', handleLogin)
        window.addEventListener('ai-preferences-sync', handleSyncEvent) // Custom event for manual trigger

        // Check on mount if user is logged in
        if (user && !hasSyncedRef.current) {
            // Wait a bit for hydrations
            if (masterKeyManager.hasMasterKey()) {
                syncPreferences()
            }
        }

        return () => {
            window.removeEventListener('user-login', handleLogin)
            window.removeEventListener('ai-preferences-sync', handleSyncEvent)
        }
    }, [user])

    return null
}
