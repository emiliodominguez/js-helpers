import * as decorators from '.';

class Test {
	@decorators.readonly
	testProp: string = 'test';

	count: number = 0;

	@decorators.log
	testLogMethod(arg: string): string {
		return `test ${arg}`;
	}

	@decorators.memoize
	testMemoizeMethod(arg: string): string {
		this.count += 1;
		return `test ${arg}`;
	}
}

describe('Decorators', () => {
	let test: Test;

	beforeEach(() => {
		test = new Test();
	});

	describe.skip('readonly', () => {
		it('should make a property readonly', () => {
			test.testProp = 'new value';
			expect(test.testProp).toBe('test');
		});
	});

	describe('log', () => {
		it("should log a method's call and return value", () => {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			jest.spyOn(console, 'log').mockImplementation(() => {});
			test.testLogMethod('arg');
			// eslint-disable-next-line no-console
			expect(console.log).toHaveBeenCalledWith('testLogMethod method called with arguments:', ['arg']);
			// eslint-disable-next-line no-console
			expect(console.log).toHaveBeenCalledWith('testLogMethod method returned:', 'test arg');
		});
	});

	describe('memoize', () => {
		it("should memoize a method's results", () => {
			expect(test.testMemoizeMethod('arg')).toBe('test arg');
			expect(test.testMemoizeMethod('arg')).toBe('test arg');
			expect(test.count).toBe(1);
		});
	});
});
