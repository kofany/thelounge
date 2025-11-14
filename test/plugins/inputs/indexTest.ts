import {assert} from "chai";
import inputs from "../../../server/plugins/inputs";

describe("inputs", function () {
    describe(".getCommands", function () {
        it("should return a non-empty array", function () {
            assert.isArray(inputs.getCommands());
            assert.isNotEmpty(inputs.getCommands());
        });

        it("should only return strings with no whitespaces and starting with /", function () {
            inputs.getCommands().forEach((command) => {
                assert.isString(command);
                assert.doesNotMatch(command, /\s/);
                assert.equal(command[0], "/");
            });
        });
    });
});
