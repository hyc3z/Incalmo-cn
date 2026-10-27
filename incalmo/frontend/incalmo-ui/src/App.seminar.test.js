import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import App from './App';

beforeEach(() => {
  jest.useFakeTimers();
  AbortSignal.timeout = jest.fn(() => undefined);
  global.fetch = jest.fn().mockResolvedValue({ok: true, json: async () => ({runs: []})});
  URL.createObjectURL = jest.fn(() => 'blob:test');
  URL.revokeObjectURL = jest.fn();
  HTMLDialogElement.prototype.showModal = function() {this.setAttribute('open', '');};
  HTMLDialogElement.prototype.close = function() {this.removeAttribute('open');};
});
afterEach(() => {jest.useRealTimers(); jest.restoreAllMocks();});

test('replay steps update the topology and never launch an operation', async () => {
  render(<App/>);
  await waitFor(() => expect(screen.getByText('Backend connected')).toBeInTheDocument());
  expect(screen.getByRole('heading', {name: 'Find the next connection'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Next stage'}));
  expect(screen.getByRole('heading', {name: 'Review access exposure'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Next stage'}));
  expect(screen.getByRole('heading', {name: 'Reach the database tier'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Inventory', exact: true}));
  expect(screen.getAllByText('Agent connected').length).toBeGreaterThanOrEqual(3);
  (fetch).mock.calls.forEach(([url, options]) => {
    expect(url).toContain('/seminar/runs');
    expect(options?.method || 'GET').toBe('GET');
  });
});

test('playback advances, pauses, and respects the selected speed', async () => {
  render(<App/>);
  await waitFor(() => expect(screen.getByText('Backend connected')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Playback speed'), {target: {value: '2'}});
  fireEvent.click(screen.getByRole('button', {name: 'Play replay', exact: true}));
  act(() => {jest.advanceTimersByTime(1400);});
  expect(screen.getByRole('heading', {name: 'Review access exposure'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Pause replay', exact: true}));
  act(() => {jest.advanceTimersByTime(1400);});
  expect(screen.getByRole('heading', {name: 'Review access exposure'})).toBeInTheDocument();
});

test('finding filters and evidence details distinguish authored data', async () => {
  render(<App/>);
  await waitFor(() => expect(screen.getByText('Backend connected')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: 'Findings', exact: true}));
  fireEvent.click(screen.getByRole('button', {name: 'medium', exact: true}));
  expect(screen.getByRole('heading', {name: 'No findings match this view'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'All severities'}));
  fireEvent.click(screen.getByRole('button', {name: /high Apache Struts service exposure/}));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/Synthetic finding for the seminar replay/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Close finding'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a real empty run stays empty instead of displaying sample attack events', async () => {
  (fetch).mockImplementation(async (url) => ({ok: true, json: async () => url.endsWith('/seminar/runs') ? {runs: [{id: 'real-run', modified: 1}]} : {id: 'real-run', title: 'Real run', origin: 'recorded', model: 'deepseek-flash', status: 'interrupted', nodes: [], edges: [], timeline: [], findings: [], modelCalls: 7, tokens: 100, limitations: []}}));
  render(<App/>);
  await waitFor(() => expect(screen.getByText('Backend connected')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /SESSION Equifax/}));
  fireEvent.click(screen.getByRole('button', {name: /real-run Recorded session/}));
  await waitFor(() => expect(screen.getByRole('heading', {name: 'No network discovery recorded'})).toBeInTheDocument());
  expect(screen.queryByText('CVE-2017-5638')).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Play replay', exact: true})).toBeDisabled();
});

test('presentation mode and report exports work without API calls', async () => {
  render(<App/>);
  await waitFor(() => expect(screen.getByText('Backend connected')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Present/}));
  expect(screen.getByRole('button', {name: /Exit presentation/})).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', {name: 'Reports', exact: true}));
  expect(screen.getByText(/ILLUSTRATIVE SCENARIO — NOT SCANNER EVIDENCE/)).toBeInTheDocument();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', {name: 'Download Markdown'}));
  fireEvent.click(screen.getByRole('button', {name: 'Download JSON'}));
  expect(click).toHaveBeenCalledTimes(2);
  expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
});
