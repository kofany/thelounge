import log from "../../../server/log.js";
import {expect, assert} from "chai";
import TestUtil from "../../util.js";
import sinon from "sinon";
import packagePlugin from "../../../server/plugins/packages";

let packages: typeof packagePlugin;

describe("packages", function () {
    let logInfoStub: sinon.SinonStub<string[], void>;

    beforeEach(async function () {
        logInfoStub = sinon.stub(log, "info");

        // Note: Dynamic import caching is handled by the module system
        // We can't easily clear the cache with ESM imports like we could with require.cache
        packages = (await import("../../../server/plugins/packages/index.js?t=" + Date.now()))
            .default;
    });

    afterEach(function () {
        logInfoStub.restore();
    });

    describe(".getStylesheets", function () {
        it("should contain no stylesheets before packages are loaded", function () {
            assert.isEmpty(packages.getStylesheets());
        });

        it("should return the list of registered stylesheets for loaded packages", function () {
            packages.loadPackages();

            expect(packages.getStylesheets()).to.deep.equal(["thelounge-package-foo/style.css"]);
        });
    });

    describe(".getPackage", function () {
        it("should contain no reference to packages before loading them", function () {
            expect(packages.getPackage("thelounge-package-foo")).to.equal(undefined);
        });

        it("should return details of a registered package after it was loaded", function () {
            packages.loadPackages();

            expect(packages.getPackage("thelounge-package-foo")).to.have.key("onServerStart");
        });
    });

    describe(".loadPackages", function () {
        it("should display report about loading packages", function () {
            // Mock `log.info` to extract its effect into a string
            logInfoStub.restore();
            let stdout = "";
            logInfoStub = sinon
                .stub(log, "info")
                .callsFake(TestUtil.sanitizeLog((str) => (stdout += str)));
            packages.loadPackages();

            expect(stdout).to.deep.equal(
                "Package thelounge-package-foo vdummy loaded\nThere are packages using the experimental plugin API. Be aware that this API is not yet stable and may change in future The Lounge releases.\n"
            );
        });
    });
});
