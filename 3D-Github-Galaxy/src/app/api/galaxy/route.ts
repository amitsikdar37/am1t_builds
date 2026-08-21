import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubGalaxyData } from '@/lib/github-service';
import { transformGitHubToGalaxy } from '@/lib/galaxy-math';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username')?.trim() || 'torvalds';
  const customToken = request.headers.get('x-custom-token') || undefined;

  try {
    const rawData = await fetchGitHubGalaxyData(username, customToken);
    const galaxyData = transformGitHubToGalaxy(rawData);

    return NextResponse.json({
      success: true,
      data: galaxyData,
    });
  } catch (error: any) {
    console.error('API Galaxy Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to initialize celestial coordinates',
      },
      { status: 500 }
    );
  }
}
