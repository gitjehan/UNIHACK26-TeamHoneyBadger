import { Client } from '@elastic/elasticsearch';
import type { BiometricEvent, LeaderboardEntry } from '@renderer/lib/types';

const BIOMETRICS_INDEX = 'kinetic-biometrics';
const LEADERBOARD_INDEX = 'kinetic-leaderboard';

const seededLeaderboard: LeaderboardEntry[] = [
  {
    nickname: 'Anubhav',
    sessionId: 'seed-1',
    avgOverallScore: 88,
    bestStreak: 56,
    totalLockedInMinutes: 930,
    level: 5,
    levelTitle: 'Ascended',
    timestamp: new Date().toISOString(),
  },
  {
    nickname: 'Jehan',
    sessionId: 'seed-2',
    avgOverallScore: 82,
    bestStreak: 43,
    totalLockedInMinutes: 420,
    level: 4,
    levelTitle: 'Guardian',
    timestamp: new Date().toISOString(),
  },
  {
    nickname: 'Eshaan',
    sessionId: 'seed-3',
    avgOverallScore: 74,
    bestStreak: 32,
    totalLockedInMinutes: 180,
    level: 3,
    levelTitle: 'Companion',
    timestamp: new Date().toISOString(),
  },
];

export class ElasticClientService {
  private client: Client | null = null;

  private enabled = false;

  private biometricsQueue: BiometricEvent[] = [];

  private fallbackLeaderboard = [...seededLeaderboard];

  constructor() {
    const endpoint = process.env.ELASTIC_ENDPOINT?.trim();
    const apiKey = process.env.ELASTIC_API_KEY?.trim();
    if (!endpoint || !apiKey) return;

    this.client = new Client({
      node: endpoint,
      auth: { apiKey },
    });
    this.enabled = true;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  queueBiometric(event: BiometricEvent): void {
    this.biometricsQueue.push(event);
  }

  async flushBiometrics(): Promise<void> {
    if (!this.biometricsQueue.length) return;
    const batch = [...this.biometricsQueue];
    this.biometricsQueue = [];

    if (!this.client) return;
    try {
      const body = batch.flatMap((event) => [{ index: { _index: BIOMETRICS_INDEX } }, event]);
      await this.client.bulk({ refresh: false, body });
    } catch (error) {
      console.warn('Elastic bulk index failed, keeping local-only mode', error);
    }
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!this.client) {
      return [...this.fallbackLeaderboard].sort((a, b) => b.avgOverallScore - a.avgOverallScore).slice(0, 20);
    }

    try {
      const response = await this.client.search({
        index: LEADERBOARD_INDEX,
        size: 20,
        sort: [{ avgOverallScore: 'desc' }],
      });
      return (
        response.hits.hits
          .map((hit) => hit._source as LeaderboardEntry)
          .filter(Boolean)
          .sort((a, b) => b.avgOverallScore - a.avgOverallScore)
      );
    } catch (error) {
      console.warn('Elastic leaderboard query failed, falling back local entries', error);
      return [...this.fallbackLeaderboard].sort((a, b) => b.avgOverallScore - a.avgOverallScore).slice(0, 20);
    }
  }

  async upsertLeaderboard(entry: LeaderboardEntry): Promise<void> {
    const existing = this.fallbackLeaderboard.findIndex((candidate) => candidate.nickname === entry.nickname);
    if (existing >= 0) this.fallbackLeaderboard[existing] = entry;
    else this.fallbackLeaderboard.push(entry);

    if (!this.client) return;
    try {
      await this.client.index({
        index: LEADERBOARD_INDEX,
        id: `${entry.nickname}:${entry.sessionId}`,
        document: entry,
        refresh: false,
      });
    } catch (error) {
      console.warn('Elastic leaderboard upsert failed', error);
    }
  }
}

export const elasticClient = new ElasticClientService();
