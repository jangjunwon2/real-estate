import { describe, it, expect } from 'vitest'
import { resolveLawdCode } from '../lib/lawdCodes'

describe('resolveLawdCode', () => {
  it('서울 시군구를 직접 매칭한다', () => {
    expect(resolveLawdCode('서울 마포구')).toBe('11440')
    expect(resolveLawdCode('서울 송파구')).toBe('11710')
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(resolveLawdCode(' 서울 강동구 ')).toBe('11740')
  })

  it('일반구가 있는 시는 도로명주소에서 구를 보완해 매칭한다', () => {
    expect(resolveLawdCode('경기 성남시', '경기 성남시 분당구 판교역로 166')).toBe('41135')
    expect(resolveLawdCode('경기 수원시', '경기 수원시 영통구 광교로 1')).toBe('41117')
  })

  it('일반구가 있는 시인데 주소로 구를 특정할 수 없으면 null', () => {
    expect(resolveLawdCode('경기 성남시')).toBeNull()
    expect(resolveLawdCode('경기 성남시', null)).toBeNull()
  })

  it('같은 구 이름이라도 시도가 다르면 혼동하지 않는다', () => {
    expect(resolveLawdCode('서울 중구')).toBe('11140')
    expect(resolveLawdCode('인천 중구')).toBe('28110')
  })

  it('미지원 지역과 빈 입력은 null', () => {
    expect(resolveLawdCode('부산 해운대구')).toBeNull()
    expect(resolveLawdCode(null)).toBeNull()
    expect(resolveLawdCode(undefined)).toBeNull()
    expect(resolveLawdCode('')).toBeNull()
  })
})
