'use client'

interface Props {
  lat: number
  lng: number
  name: string
  locationInfo?: {
    nearest_subway?: string | null
    nearest_subway_min?: number | null
    mart_min?: number | null
    hospital_min?: number | null
    park_min?: number | null
    school_count_1km?: number | null
  } | null
}

const TILE = 256
const MAP_W = 640
const MAP_H = 320
const ZOOM = 16

function latLngToPixel(lat: number, lng: number) {
  const n = Math.pow(2, ZOOM)
  const px = (lng + 180) / 360 * n * TILE
  const latRad = lat * Math.PI / 180
  const py = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n * TILE
  return { px, py }
}

function sub(tx: number, ty: number) {
  return ['a', 'b', 'c'][(Math.abs(tx) + Math.abs(ty)) % 3]
}

export default function PropertyMap({ lat, lng, name }: Props) {
  const { px, py } = latLngToPixel(lat, lng)

  const originPx = px - MAP_W / 2
  const originPy = py - MAP_H / 2

  const tileXMin = Math.floor(originPx / TILE)
  const tileYMin = Math.floor(originPy / TILE)
  const tileXMax = Math.floor((originPx + MAP_W) / TILE)
  const tileYMax = Math.floor((originPy + MAP_H) / TILE)

  const tiles: { tx: number; ty: number; left: number; top: number }[] = []
  for (let ty = tileYMin; ty <= tileYMax; ty++) {
    for (let tx = tileXMin; tx <= tileXMax; tx++) {
      tiles.push({ tx, ty, left: tx * TILE - originPx, top: ty * TILE - originPy })
    }
  }

  const markerLeft = px - originPx
  const markerTop  = py - originPy

  const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(name)}`

  return (
    <div className="space-y-2">
      <div style={{ position: 'relative', width: '100%', height: MAP_H, borderRadius: 12, overflow: 'hidden', background: '#e5e7eb' }}>

        {/* OSM 타일 이미지 */}
        {tiles.map(({ tx, ty, left, top }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${tx}-${ty}`}
            src={`/api/tile/${ZOOM}/${tx}/${ty}`}
            alt=""
            width={TILE}
            height={TILE}
            style={{ position: 'absolute', left, top, display: 'block' }}
          />
        ))}

        {/* 마커 */}
        <div style={{
          position: 'absolute',
          left: markerLeft - 50,
          top: markerTop - 52,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          pointerEvents: 'none', zIndex: 10,
        }}>
          <div style={{
            padding: '5px 14px', background: '#1E3A5F', color: '#fff',
            borderRadius: 20, fontSize: 12, fontWeight: 700,
            whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
          }}>
            {name}
          </div>
          <div style={{
            width: 0, height: 0,
            borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
            borderTop: '9px solid #1E3A5F',
          }} />
        </div>

        {/* 진단: 컴포넌트 렌더 확인 */}
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 20,
          background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11,
          padding: '3px 8px', borderRadius: 4,
        }}>
          lat:{lat.toFixed(4)} lng:{lng.toFixed(4)} / tiles:{tiles.length}
        </div>

        {/* 저작권 */}
        <div style={{
          position: 'absolute', bottom: 4, right: 6,
          fontSize: 10, color: '#555', background: 'rgba(255,255,255,.75)',
          padding: '1px 4px', borderRadius: 2, zIndex: 10,
        }}>
          © OpenStreetMap
        </div>
      </div>

      <a href={naverUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors">
        네이버 지도에서 보기 ↗
      </a>
    </div>
  )
}
