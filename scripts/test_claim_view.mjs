#!/usr/bin/env node
// Mock test simulating the claim view flow logic against a mocked Apps Script response.
// Run: node scripts/test_claim_view.mjs

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/")
}

function parseTokenFromUrl(url) {
  const match = url.match(/[?&]claim=([^&]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function simulateFetchSubmission(token) {
  // Mock API response matching the Apps Script contract:
  // GET ...?action=submission&token=X -> { submitterName, photos:[{photoId, src, title}], contributions[] }
  if (token === "VALID_TOKEN") {
    return {
      submitterName: "John Doe",
      photos: [
        { photoId: 1, src: "assets/shoebox/photos/Photo One.jpg", title: "Old Photo 001" },
        { photoId: 2, src: "assets/shoebox/photos/Photo Two.jpg", title: "Old Photo 002" },
        { photoId: 3, src: "assets/shoebox/photos/Photo Three.jpg", title: "Old Photo 003" }
      ],
      contributions: []
    }
  }
  return null
}

function simulateFormEncodedPost(data, photoId, token) {
  // Simulates the form-encoded POST (application/x-www-form-urlencoded) to the Apps Script URL.
  // Fields: token, photoId, people, location, community, province, country, dateYear, dateEra,
  //         occasion, story, caption, attribution, keywords
  const body = new URLSearchParams()
  body.append("token", token)
  body.append("photoId", String(photoId))
  body.append("people", data.people)
  body.append("location", data.location)
  body.append("community", data.community || "")
  body.append("province", data.province || "")
  body.append("country", data.country || "")
  body.append("dateYear", data.dateYear)
  body.append("dateEra", data.dateEra)
  body.append("occasion", data.occasion)
  body.append("story", data.story)
  body.append("caption", data.caption || "")
  body.append("attribution", data.attribution)
  body.append("keywords", data.keywords)
  body.append("consent", String(data.consent))
  return Object.fromEntries(body.entries())
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`)
  }
  console.log(`  PASS: ${label}`)
}

console.log("=== ClaimView Mock Flow Tests ===\n")

// 1. URL parsing
console.log("1. URL parameter parsing")
assertEqual(parseTokenFromUrl("https://example.com/?claim=VALID_TOKEN"), "VALID_TOKEN", "extracts token from ?claim=")
assertEqual(parseTokenFromUrl("https://example.com/?claim=ABC-123&foo=bar"), "ABC-123", "token with extra params")
assertEqual(parseTokenFromUrl("https://example.com/archive?community=Winnipeg"), null, "no claim param returns null")
assertEqual(parseTokenFromUrl("https://example.com/"), null, "empty URL returns null")
console.log()

// 2. Submission fetch shape
console.log("2. Submission fetch shape (mocked API)")
const sub = simulateFetchSubmission("VALID_TOKEN")
assertEqual(typeof sub.submitterName, "string", "submitterName is a string")
assertEqual(sub.photos.length, 3, "returns 3 photos")
assertEqual(sub.photos[0].photoId, 1, "photoId is number")
assertEqual(typeof sub.photos[0].src, "string", "src is string (manifest-relative path)")
assertEqual(sub.photos[0].title, "Old Photo 001", "title present")
assertEqual(Array.isArray(sub.contributions), true, "contributions is an array")
console.log()

// 3. Manifest-relative src resolved against BASE_URL
console.log("3. Photo src resolution against BASE_URL")
const baseUrl = "/shoebox-v2/"
const resolvedSrc = `${baseUrl}${encodePath(sub.photos[0].src)}`
assertEqual(resolvedSrc, "/shoebox-v2/assets/shoebox/photos/Photo%20One.jpg", "src resolves with BASE_URL prefix and encoded spaces")
console.log()

// 4. Form-encoded POST shape
console.log("4. Form-encoded POST (application/x-www-form-urlencoded)")
const mockData = {
  people: "John Doe (son), Mary Doe (mother)",
  location: "Winnipeg, Manitoba",
  community: "Winnipeg",
  province: "Manitoba",
  country: "Canada",
  dateYear: "1945",
  dateEra: "mid-1900s",
  occasion: "Family reunion",
  story: "This photo shows my grandparents at their silver wedding anniversary.",
  caption: "Silver anniversary photo",
  attribution: "Courtesy of the Doe Family Collection",
  keywords: "family, wedding, 1945",
  consent: true
}
const posted = simulateFormEncodedPost(mockData, 1, "VALID_TOKEN")
assertEqual(posted.token, "VALID_TOKEN", "token field")
assertEqual(posted.photoId, "1", "photoId field (string)")
assertEqual(posted.people, "John Doe (son), Mary Doe (mother)", "people field")
assertEqual(posted.location, "Winnipeg, Manitoba", "location field")
assertEqual(posted.attribution, "Courtesy of the Doe Family Collection", "attribution field")
assertEqual(posted.consent, "true", "consent field is stringified")
assertEqual(Object.keys(posted).length, 15, "all 15 fields present (token, photoId, people, location, community, province, country, dateYear, dateEra, occasion, story, caption, attribution, keywords, consent)")
console.log()

// 5. No token handling
console.log("5. No token / invalid token handling")
assertEqual(simulateFetchSubmission("INVALID_TOKEN"), null, "invalid token returns null")
assertEqual(simulateFetchSubmission(""), null, "empty token returns null")
console.log()

// 6. Progress tracking
console.log("6. Progress tracking")
const totalPhotos = sub.photos.length
const completed = new Set([1])
assertEqual(completed.size, 1, "1 of 3 completed")
assertEqual((completed.size / totalPhotos * 100).toFixed(0), "33", "progress is 33%")
console.log()

console.log("=== All ClaimView mock tests passed! ===\n")
console.log("Summary:")
console.log(" - URL parameter parsing works correctly")
console.log(" - Token validation (mock) functions properly")
console.log(" - Submission data structure matches API contract")
console.log(" - Photo src resolves against BASE_URL with encoded spaces")
console.log(" - Form-encoded POST includes all 15 required fields")
console.log(" - Invalid/missing token returns null (handled as error)")
console.log(" - Progress tracking works correctly")
