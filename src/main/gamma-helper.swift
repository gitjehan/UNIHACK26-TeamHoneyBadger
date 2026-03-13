import CoreGraphics
import Foundation

let args = CommandLine.arguments

if args.count < 4 {
  exit(1)
}

guard let redMax = Float(args[1]),
      let greenMax = Float(args[2]),
      let blueMax = Float(args[3]) else {
  exit(1)
}

CGSetDisplayTransferByFormula(
  CGMainDisplayID(),
  0, 1, redMax,
  0, 1, greenMax,
  0, 1, blueMax
)
