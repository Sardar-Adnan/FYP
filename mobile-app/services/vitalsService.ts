import { VitalsConfig } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';

export interface VitalsResult {
    heart_rate: number;
    systolic: number;
    diastolic: number;
    health_risk?: number;  // 0.0 to 1.0
    risk_label?: 'low' | 'moderate' | 'high';
}

export interface VitalsApiResponse {
    ok: boolean;
    result?: VitalsResult;
    error?: string;
}

export const VitalsService = {
    /**
     * Analyzes a fingertip video to extract vital signs and predict health risk.
     * Sends the video to the Django backend PPG processing endpoint.
     * 
     * @param videoUri - Local file URI of the recorded video
     * @param userProfile - Optional user profile for health prediction
     * @returns VitalsResult with vitals and health prediction
     */
    async analyzeVideo(videoUri: string, userProfile?: UserProfile | null): Promise<VitalsResult> {
        const formData = new FormData();

        // Extract filename from URI
        const filename = videoUri.split('/').pop() || 'video.mp4';

        // Append video file to form data
        formData.append('video', {
            uri: videoUri,
            type: 'video/mp4',
            name: filename,
        } as any);

        // Add optional config parameters
        formData.append('window_sec', '12.0');
        formData.append('hop_sec', '6.0');

        // Add user profile data for health prediction
        if (userProfile) {
            if (userProfile.age) formData.append('age', String(userProfile.age));
            if (userProfile.gender) formData.append('gender', userProfile.gender);
            if (userProfile.height) formData.append('height', String(userProfile.height));
            if (userProfile.weight) formData.append('weight', String(userProfile.weight));
        }

        const url = `${VitalsConfig.API_BASE_URL}${VitalsConfig.PPG_ENDPOINT}`;



        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[VitalsService] API error:', errorText);
            throw new Error(`Server error: ${response.status}`);
        }

        const data: VitalsApiResponse = await response.json();

        if (!data.ok || !data.result) {
            throw new Error(data.error || 'Unknown error processing video');
        }


        return data.result;
    },

    /**
     * Saves vital signs to Supabase for history tracking.
     * 
     * @param userId - The user's Supabase ID
     * @param result - The vitals measurement result
     * @returns The inserted record or throws on error
     */
    async saveToSupabase(userId: string, result: VitalsResult) {
        const { data, error } = await supabase
            .from('vitals')
            .insert({
                user_id: userId,
                heart_rate: Math.round(result.heart_rate),
                systolic_bp: Math.round(result.systolic),
                diastolic_bp: Math.round(result.diastolic),
                health_risk: result.health_risk,
                risk_label: result.risk_label,
                recorded_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[VitalsService] Failed to save vitals:', error);
            throw error;
        }


        return data;
    },
};

