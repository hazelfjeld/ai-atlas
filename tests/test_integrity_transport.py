"""The GitHack verifier retries transport resets but never accepts bad bytes."""
import io
from email.message import Message
from http.client import IncompleteRead
from pathlib import Path
import sys
import unittest
from urllib.error import HTTPError
from urllib.request import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from validate_checkpoint import read_remote_response


class Response(io.BytesIO):
    def __init__(self, data, failure=None):
        super().__init__(data)
        self.status = 200
        self.headers = Message()
        self.headers.add_header('Content-Type', 'text/html')
        self.failure = failure

    def read(self, size=-1):
        if self.failure is not None:
            raise self.failure
        return super().read(size)


class IntegrityTransport(unittest.TestCase):
    def setUp(self):
        self.req = Request('https://rawcdn.githack.com/hazelfjeld/ai-atlas/sha/index.html')

    def test_mid_read_reset_retries_and_returns_complete_response(self):
        calls, delays = [], []
        def open_(req, timeout):
            self.assertEqual(timeout, 25)
            calls.append(req.full_url)
            return Response(b'partial', ConnectionResetError('reset')) if len(calls) == 1 else Response(b'exact')
        self.assertEqual(read_remote_response(self.req, 6, opener=open_, pause=delays.append),
                         (200, b'exact', 'text/html'))
        self.assertEqual((len(calls), delays), (2, [0.5]))

    def test_repeated_read_reset_exhausts_and_raises(self):
        calls = []
        def open_(req, timeout):
            calls.append(1)
            return Response(b'partial', ConnectionResetError('reset'))
        with self.assertRaises(ConnectionResetError):
            read_remote_response(self.req, 6, opener=open_, attempts=3, pause=lambda _: None)
        self.assertEqual(len(calls), 3)

    def test_http_errors_do_not_retry(self):
        calls = []
        def open_(req, timeout):
            calls.append(1)
            raise HTTPError(req.full_url, 404, 'Not Found', {}, None)
        with self.assertRaises(HTTPError):
            read_remote_response(self.req, 6, opener=open_, pause=lambda _: None)
        self.assertEqual(len(calls), 1)

    def test_incomplete_reads_retry_with_a_new_response(self):
        calls = []
        def open_(req, timeout):
            calls.append(1)
            return Response(b'partial', IncompleteRead(b'part', 2)) if len(calls) == 1 else Response(b'exact')
        self.assertEqual(read_remote_response(self.req, 6, opener=open_, pause=lambda _: None)[1], b'exact')
        self.assertEqual(len(calls), 2)


if __name__ == '__main__':
    unittest.main()
