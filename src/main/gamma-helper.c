#include <CoreGraphics/CoreGraphics.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    if (argc < 4) return 1;

    float red   = (float)atof(argv[1]);
    float green = (float)atof(argv[2]);
    float blue  = (float)atof(argv[3]);

    uint32_t displayCount = 0;
    CGGetActiveDisplayList(0, NULL, &displayCount);
    if (displayCount == 0) return 0;

    CGDirectDisplayID displays[16];
    CGGetActiveDisplayList(displayCount, displays, &displayCount);

    for (uint32_t i = 0; i < displayCount; i++) {
        CGSetDisplayTransferByFormula(displays[i],
            0, red,   1.0,
            0, green, 1.0,
            0, blue,  1.0);
    }
    return 0;
}
