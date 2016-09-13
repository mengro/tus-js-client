/* global FakeBlob tus */

describe("tus", function () {
  describe("#Upload", function () {

    beforeEach(function () {
      jasmine.Ajax.install();
      localStorage.clear();
    });

    afterEach(function () {
      jasmine.Ajax.uninstall();
    });

    it("should resume an upload from a stored url", function (done) {
      localStorage.setItem("fingerprinted", "http://tus.io/uploads/resuming");

      var file = new FakeBlob("hello world".split(""));
      var options = {
        endpoint: "http://tus.io/uploads",
        onProgress: function () {},
        fingerprint: function () {}
      };
      spyOn(options, "fingerprint").and.returnValue("fingerprinted");
      spyOn(options, "onProgress");

      var upload = new tus.Upload(file, options);
      upload.start();

      expect(options.fingerprint).toHaveBeenCalledWith(file);

      var req = jasmine.Ajax.requests.mostRecent();
      expect(req.url).toBe("http://tus.io/uploads/resuming");
      expect(req.method).toBe("HEAD");
      expect(req.requestHeaders["Tus-Resumable"]).toBe("1.0.0");

      req.respondWith({
        status: 204,
        responseHeaders: {
          "Upload-Length": 11,
          "Upload-Offset": 3
        }
      });

      expect(upload.url).toBe("http://tus.io/uploads/resuming");

      req = jasmine.Ajax.requests.mostRecent();
      expect(req.url).toBe("http://tus.io/uploads/resuming");
      expect(req.method).toBe("PATCH");
      expect(req.requestHeaders["Tus-Resumable"]).toBe("1.0.0");
      expect(req.requestHeaders["Upload-Offset"]).toBe(3);
      expect(req.contentType()).toBe("application/offset+octet-stream");
      expect(req.params.size).toBe(11 - 3);

      req.respondWith({
        status: 204,
        responseHeaders: {
          "Upload-Offset": 11
        }
      });

      expect(options.onProgress).toHaveBeenCalledWith(11, 11);
      done();
    });

    it("should store upload urls", function (done) {
      var file = new FakeBlob("hello world".split(""));
      var options = {
        endpoint: "http://tus.io/uploads",
        fingerprint: function () {}
      };
      spyOn(options, "fingerprint").and.returnValue("fingerprinted");

      var upload = new tus.Upload(file, options);
      upload.start();

      expect(options.fingerprint).toHaveBeenCalledWith(file);

      var req = jasmine.Ajax.requests.mostRecent();
      expect(req.url).toBe("http://tus.io/uploads");
      expect(req.method).toBe("POST");

      req.respondWith({
        status: 201,
        responseHeaders: {
          Location: "/uploads/blargh"
        }
      });

      expect(upload.url).toBe("http://tus.io/uploads/blargh");
      expect(localStorage.getItem("fingerprinted")).toBe("http://tus.io/uploads/blargh");
      done();
    });

    it("should add the request's body to errors", function () {
      var file = new FakeBlob("hello world".split(""));
      var err;
      var options = {
        endpoint: "http://tus.io/uploads",
        onError: function (e) {
          err = e;
        }
      };

      var upload = new tus.Upload(file, options);
      upload.start();

      var req = jasmine.Ajax.requests.mostRecent();
      expect(req.url).toBe("http://tus.io/uploads");
      expect(req.method).toBe("POST");

      req.respondWith({
        status: 500,
        responseText: "server_error"
      });

      expect(err.message).toBe("tus: unexpected response while creating upload, originated from request (response code: 500, response text: server_error)");
      expect(err.originalRequest).toBeDefined();
    });
  });
});
