import api from './client';
import type { User } from '../types';

export async function login(username: string, password: string): Promise<string> {
  const { data } = await api.post('/auth/login', { username, password });
  return data.access_token;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function registerUser(payload: {
  username: string;
  email: string;
  password: string;
  role: string;
}): Promise<User> {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

export async function listUsers(): Promise<User[]> {
  const { data } = await api.get('/auth/users');
  return data;
}
