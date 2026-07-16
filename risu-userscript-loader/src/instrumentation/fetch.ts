export function fetchText(url: string): Promise<string> {
  if (typeof GM !== 'undefined' && GM.xmlHttpRequest) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest!({
        method: 'GET',
        url,
        onload(response) {
          response.status >= 200 && response.status < 300
            ? resolve(response.responseText)
            : reject(new Error(`GET ${url} failed with ${response.status}`))
        },
        onerror: reject,
      })
    })
  }
  return fetch(url, { credentials: 'include' }).then((response) => {
    if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`)
    return response.text()
  })
}
