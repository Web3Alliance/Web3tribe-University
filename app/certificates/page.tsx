'use client'

import { useState, useEffect } from 'react'
import { Award, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

interface Certificate {
  id: string
  course_id: string
  user_id: string
  status: 'pending' | 'minted'
  nft_token_id?: string
  nft_transaction_hash?: string
  nft_metadata_url?: string
  issued_at: string
  courses: {
    title: string
    category: string
  }
}

export default function CertificatesPage() {
  const { user, profile } = useAuth()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [minting, setMinting] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (user) {
      fetchCertificates()
    }
  }, [user])

  const fetchCertificates = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          courses:course_id (
            title,
            category
          )
        `)
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false })

      if (error) throw error
      setCertificates(data || [])
    } catch (error) {
      console.error('[v0] Error fetching certificates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMintNFT = async (certificateId: string) => {
    setMinting(certificateId)

    try {
      const response = await fetch('/api/certificates/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificate_id: certificateId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mint NFT')
      }

      // Refresh certificates
      await fetchCertificates()
      alert('Certificate NFT minted successfully!')
    } catch (error: any) {
      alert(error.message)
    } finally {
      setMinting(null)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <p className="text-center text-muted-foreground">Please sign in to view your certificates</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Certificates</h1>
          <p className="text-muted-foreground">
            Your course completion certificates as NFTs on Pi Blockchain
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : certificates.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Award className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Certificates Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Complete a course to earn your first certificate NFT
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {certificates.map((cert) => (
              <Card key={cert.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base mb-2">{cert.courses.title}</CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{cert.courses.category}</Badge>
                        {cert.status === 'minted' ? (
                          <Badge className="bg-secondary text-secondary-foreground">
                            <Award className="h-3 w-3 mr-1" />
                            NFT Minted
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recipient</span>
                      <span className="font-medium">{profile?.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issued</span>
                      <span>
                        {formatDistanceToNow(new Date(cert.issued_at), { addSuffix: true })}
                      </span>
                    </div>
                    {cert.nft_token_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NFT Token ID</span>
                        <span className="font-mono text-xs">{cert.nft_token_id}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {cert.status === 'pending' ? (
                      <Button
                        className="flex-1"
                        onClick={() => handleMintNFT(cert.id)}
                        disabled={minting === cert.id}
                      >
                        {minting === cert.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Minting...
                          </>
                        ) : (
                          <>
                            <Award className="h-4 w-4 mr-2" />
                            Mint as NFT
                          </>
                        )}
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" className="flex-1 bg-transparent" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        {cert.nft_transaction_hash && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `https://pi-blockchain.net/tx/${cert.nft_transaction_hash}`,
                                '_blank'
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Award className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">About Certificate NFTs</p>
                <p className="text-muted-foreground">
                  All certificates are issued as NFTs on the Pi Blockchain, ensuring authenticity
                  and permanent verification. Your full name from your profile appears on each
                  certificate.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
