import crypto from 'node:crypto';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOtp() {
  const max = 10 ** env.otp.length;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(env.otp.length, '0');
}

/**
 * Generic OTP request/verify against Redis, parameterized by a key prefix
 * (so student-mobile and staff-email OTPs use isolated key spaces) and a
 * delivery function (SMS vs email).
 */
export function makeOtpChannel(prefix) {
  const otpKey = (id) => `${prefix}:otp:${id}`;
  const attemptsKey = (id) => `${prefix}:attempts:${id}`;
  const rateKey = (id) => `${prefix}:rate:${id}`;

  async function request(identifier, deliver) {
    const requests = await redis.incr(rateKey(identifier));
    if (requests === 1) {
      await redis.expire(rateKey(identifier), env.otp.requestWindowSeconds);
    }
    if (requests > env.otp.maxRequestsPerWindow) {
      const err = new Error('Too many OTP requests. Try again later.');
      err.code = 'RATE_LIMITED';
      throw err;
    }

    const otp = generateOtp();
    await redis.set(otpKey(identifier), hashOtp(otp), 'EX', env.otp.ttlSeconds);
    await redis.del(attemptsKey(identifier));

    await deliver(otp);
  }

  async function verify(identifier, submittedOtp) {
    const attempts = await redis.incr(attemptsKey(identifier));
    if (attempts === 1) {
      await redis.expire(attemptsKey(identifier), env.otp.ttlSeconds);
    }
    if (attempts > env.otp.maxVerifyAttempts) {
      const err = new Error('Too many incorrect attempts. Request a new OTP.');
      err.code = 'TOO_MANY_ATTEMPTS';
      throw err;
    }

    const storedHash = await redis.get(otpKey(identifier));
    if (!storedHash) {
      const err = new Error('OTP expired or not requested.');
      err.code = 'EXPIRED';
      throw err;
    }

    if (storedHash !== hashOtp(submittedOtp)) {
      const err = new Error('Incorrect OTP.');
      err.code = 'INVALID';
      throw err;
    }

    await redis.del(otpKey(identifier));
    await redis.del(attemptsKey(identifier));
  }

  return { request, verify };
}
