import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'

describe('<App/>', () => {
  it('adds a task from quick add and shows it in the inbox', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = await screen.findByRole('textbox', { name: 'Quick add task' })
    await user.type(input, 'Write release notes p2{Enter}')
    const main = screen.getByRole('main')
    expect(await within(main).findByText('Write release notes')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('keeps tasks after a remount (IndexedDB persistence)', async () => {
    render(<App />)
    expect(await screen.findByText('Write release notes')).toBeInTheDocument()
  })
})

describe('Completed view', () => {
  it('lists only completed tasks', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = await screen.findByRole('textbox', { name: 'Quick add task' })
    await user.type(input, 'Still open{Enter}')
    await user.type(input, 'Finish me{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Complete “Finish me”' }))
    await new Promise(r => setTimeout(r, 400))
    window.dispatchEvent(new CustomEvent('todos:set-view', { detail: 'completed' }))
    const main = screen.getByRole('main')
    expect(await within(main).findByText('Finish me')).toBeInTheDocument()
    expect(within(main).queryByText('Still open')).not.toBeInTheDocument()
  })
})
