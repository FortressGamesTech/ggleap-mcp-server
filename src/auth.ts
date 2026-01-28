/**
 * GGLeap JWT Authentication Manager
 */
export class GGLeapAuth {
  private jwt: string | null = null;
  private jwtExpiry: number | null = null;
  private readonly TOKEN_LIFETIME = 10 * 60 * 1000; // 10 minutes
  private readonly REFRESH_THRESHOLD = 60 * 1000; // Refresh 1 minute before expiry

  constructor(
    private readonly authToken: string,
    private readonly baseUrl: string = 'https://api.ggleap.com/production'
  ) {}

  async getJWT(): Promise<string> {
    const now = Date.now();
    
    if (!this.jwt || !this.jwtExpiry || now > this.jwtExpiry - this.REFRESH_THRESHOLD) {
      await this.refreshJWT();
    }
    
    return this.jwt!;
  }

  async refreshJWT(): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/authorization/public-api/auth`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ AuthToken: this.authToken })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to authenticate: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.jwt = data.Jwt;
    this.jwtExpiry = Date.now() + this.TOKEN_LIFETIME;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const jwt = await this.getJWT();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return response.json();
  }
}