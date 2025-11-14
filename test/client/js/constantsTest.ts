import {assert} from "chai";
import constants from "../../../client/js/constants";
import {describe} from "mocha";

describe("client-side constants", function () {
    describe(".colorCodeMap", function () {
        it("should be a non-empty array", function () {
            assert.isArray(constants.colorCodeMap);
            assert.lengthOf(constants.colorCodeMap, 16);
        });

        it("should be made of pairs of strings", function () {
            constants.colorCodeMap.forEach(([code, name]) => {
                assert.isString(code);
                assert.match(code, /[0-9]{2}/);
                assert.isString(name);
            });
        });
    });

    describe(".timeFormats", function () {
        it("should be objects of strings", function () {
            assert.isString(constants.timeFormats.msgDefault);
            assert.isNotEmpty(constants.timeFormats.msgDefault);
            assert.isString(constants.timeFormats.msgWithSeconds);
            assert.isNotEmpty(constants.timeFormats.msgWithSeconds);
        });
    });
});
