import { pool } from "../../db/pool";

type AuthOtpRow = {
    id: number;
    email_sat: string;
    cabang: string;
    otp_hash: string;
    otp_token: string;
    expires_at: Date;
    created_at: Date;
    consumed_at: Date | null;
};

export const authOtpRepository = {
    async invalidateActive(emailSat: string, cabang: string) {
        await pool.query(
            `
            UPDATE auth_otp
            SET consumed_at = timezone('Asia/Jakarta', now())
            WHERE LOWER(email_sat) = LOWER($1)
              AND LOWER(cabang) = LOWER($2)
              AND consumed_at IS NULL
              AND expires_at > timezone('Asia/Jakarta', now())
            `,
            [emailSat, cabang]
        );
    },

    async create(input: {
        email_sat: string;
        cabang: string;
        otp_hash: string;
        otp_token: string;
        expires_at: Date;
    }): Promise<AuthOtpRow> {
        const result = await pool.query<AuthOtpRow>(
            `
            INSERT INTO auth_otp (email_sat, cabang, otp_hash, otp_token, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email_sat, cabang, otp_hash, otp_token, expires_at, created_at, consumed_at
            `,
            [input.email_sat, input.cabang, input.otp_hash, input.otp_token, input.expires_at]
        );

        return result.rows[0];
    },

    async findActiveByToken(emailSat: string, cabang: string, otpToken: string): Promise<AuthOtpRow | null> {
        const result = await pool.query<AuthOtpRow>(
            `
            SELECT id, email_sat, cabang, otp_hash, otp_token, expires_at, created_at, consumed_at
            FROM auth_otp
            WHERE LOWER(email_sat) = LOWER($1)
              AND LOWER(cabang) = LOWER($2)
              AND otp_token = $3
              AND consumed_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [emailSat, cabang, otpToken]
        );

        return result.rows[0] ?? null;
    },

    async consumeById(id: number) {
        await pool.query(
            `
            UPDATE auth_otp
            SET consumed_at = timezone('Asia/Jakarta', now())
            WHERE id = $1
            `,
            [id]
        );
    }
};
