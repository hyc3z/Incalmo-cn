import asyncio
import logging
from incalmo.reporting import generate_report
from incalmo.core.strategies.strategy_factory import StrategyFactory
from config.attacker_config import AttackerConfig

TIMEOUT_SECONDS = 75 * 60

strategy_factory = StrategyFactory()


async def run_incalmo_strategy(config: AttackerConfig, task_id: str):
    """Run incalmo with the specified strategy"""
    strategy = strategy_factory.build_strategy(config, task_id)

    status = "failed"
    try:
        await strategy.initialize()
        start_time = asyncio.get_event_loop().time()
        while True:
            result = await strategy.main()
            if result:
                # A strategy can also end after a model error; don't imply success.
                status = "ended"
                break
            if asyncio.get_event_loop().time() - start_time > TIMEOUT_SECONDS:
                status = "timed_out"
                break
            await asyncio.sleep(0.5)
    except (asyncio.CancelledError, KeyboardInterrupt):
        status = "interrupted"
        raise
    finally:
        # Offline generation also works during Ctrl+C and never adds an API charge.
        try:
            report = generate_report(strategy.logging_service.logger_dir_path, status=status)
            print(f"Brief report saved to {report}")
        except Exception:
            logging.getLogger(__name__).exception("Could not generate the brief report")
