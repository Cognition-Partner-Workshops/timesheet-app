import Foundation

/// Intercepts every request made through a `URLSession` configured with this
/// protocol class and answers it from a handler installed by the test.
final class MockURLProtocol: URLProtocol {
    struct Response {
        var status: Int
        var body: Data
        var headers: [String: String] = ["Content-Type": "application/json"]
    }

    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) throws -> Response)?

    static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unsupportedURL))
            return
        }
        do {
            var request = self.request
            if let stream = request.httpBodyStream {
                stream.open()
                var body = Data()
                let bufferSize = 4096
                let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
                defer { buffer.deallocate() }
                while stream.hasBytesAvailable {
                    let read = stream.read(buffer, maxLength: bufferSize)
                    if read <= 0 { break }
                    body.append(buffer, count: read)
                }
                stream.close()
                request.httpBody = body
            }
            let response = try handler(request)
            let http = HTTPURLResponse(url: request.url!, statusCode: response.status, httpVersion: nil, headerFields: response.headers)!
            client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: response.body)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
