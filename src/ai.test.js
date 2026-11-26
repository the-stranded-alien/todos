import { describe, it, expect } from 'vitest'
import { quickSteps, parseSteps, stepRange } from './ai.js'

describe('quickSteps (non-AI fallback)', () => {
  it('uses list items from the notes', () => {
    expect(quickSteps({ title: 'Trip', notes: 'Packing:\n- Book flights\n- Reserve hotel\n* Pack bags\n1. Get euros' }))
      .toEqual(['Book flights', 'Reserve hotel', 'Pack bags', 'Get euros'])
  })
  it('uses lines, then sentences', () => {
    expect(quickSteps({ title: 'x', notes: 'Call bank\nEmail landlord' })).toEqual(['Call bank', 'Email landlord'])
    expect(quickSteps({ title: 'x', notes: 'Clear the desk. Sort the mail; File the receipts.' })).toEqual(['Clear the desk', 'Sort the mail', 'File the receipts'])
  })
  it('splits a compound title', () => {
    expect(quickSteps({ title: 'buy milk, eggs and bread', notes: '' })).toEqual(['Buy milk', 'Eggs', 'Bread'])
  })
  it('returns nothing when there is nothing to split', () => {
    expect(quickSteps({ title: 'Relax', notes: '' })).toEqual([])
  })
})

describe('parseSteps (model output)', () => {
  it('accepts JSON arrays and object wrappers, cleans and de-duplicates', () => {
    expect(parseSteps('["1. Draft outline", "Draft outline", "- Send to Sam."]')).toEqual(['Draft outline', 'Send to Sam'])
    expect(parseSteps('{"subtasks":["A step","B step"]}')).toEqual(['A step', 'B step'])
  })
  it('falls back to lines', () => {
    expect(parseSteps('- one thing\n- two things')).toEqual(['one thing', 'two things'])
  })
  it('caps at 8', () => {
    expect(parseSteps(JSON.stringify([...Array(12)].map((_, i) => `Step ${i}`)))).toHaveLength(8)
  })
})

describe('stepRange', () => {
  it('scales with input size', () => {
    expect(stepRange({ title: 'Fix sink' })).toEqual([3, 4])
    expect(stepRange({ title: 'Plan', notes: 'word '.repeat(60) })).toEqual([4, 8])
  })
})
