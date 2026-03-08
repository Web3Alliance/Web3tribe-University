import { NextResponse } from 'next/server'

export async function GET() {
  const appInfo = {
    name: 'Web3Tribe University',
    description: 'Learn Web3 and earn W3TR tokens - A mobile-first learning management system that rewards users with tokens for completing educational modules.',
    version: '1.0.0',
    developer: {
      name: 'Skiibiidarsh',
      url: 'https://github.com/Skiibiidarsh',
      github: '@Skiibiidarsh'
    },
    repository: {
      type: 'git',
      url: 'https://github.com/Web3Alliance/Web3tribe-University.git',
      web: 'https://github.com/Web3Alliance/Web3tribe-University'
    },
    website: 'https://www.tribe.theweb3alliance.org/',
    publisher: 'Web3Alliance',
    category: 'Education',
    tags: ['education', 'web3', 'blockchain', 'learning', 'tokens', 'nft', 'certificates'],
    permissions: ['username'],
    support: {
      url: 'https://github.com/Web3Alliance/Web3tribe-University/issues',
      email: 'support@tribe.theweb3alliance.org'
    },
    social: {
      github: 'https://github.com/Web3Alliance/Web3tribe-University',
      website: 'https://www.tribe.theweb3alliance.org/',
      developer: 'https://github.com/Skiibiidarsh'
    },
    features: [
      'Learn and earn W3TR tokens',
      'NFT certificates on Pi blockchain',
      'Classroom forums for peer interaction',
      'Course creation for tutors',
      'Token swap with Pi Network',
      'Progress tracking and rewards'
    ]
  }

  return NextResponse.json(appInfo, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  })
}
